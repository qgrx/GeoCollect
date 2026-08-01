import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mock API : GET /api/quiz/current est piloté par le test (réponse « pas encore
// de quiz, prochain à telle heure », ou promesse qui ne se règle JAMAIS pour rejouer
// une requête perdue en vol sur mobile).
let currentImpl = async () => ({ data: null, error: null })
let answerImpl  = async () => ({ data: null, error: null })
const currentCalls = []
vi.mock('../services/api.js', () => ({
  apiGetCurrentQuiz: vi.fn(() => { currentCalls.push(1); return currentImpl() }),
  apiJoinQuiz:       async () => ({ data: null, error: null }),
  apiAnswerQuiz:     vi.fn(() => answerImpl()),
}))

import { useQuiz } from '../hooks/useQuiz.js'

const OPTS = {
  profile: { id: 'u1', pseudo: 'Kosni' }, isDemo: false, limits: { quizInterval: 60 }, cardPool: [],
  earnCard: () => {}, earnGoldWithFx: () => {}, showToast: () => {}, t: k => k,
}

describe('useQuiz — compteur du prochain quiz', () => {
  beforeEach(() => { currentCalls.length = 0; vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('se recale sur next_quiz_at quand le compteur est arrivé à zéro trop tôt', async () => {
    // Le serveur n'a pas encore lancé le quiz : il annonce le prochain dans 45 s.
    currentImpl = async () => ({
      data: {
        quiz: null,
        next_quiz_at:     new Date(Date.now() + 45_000).toISOString(),
        next_card_rarity: 'épique',
        server_time:      new Date().toISOString(),
      },
      error: null,
    })

    const { result } = renderHook(() => useQuiz(OPTS))
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })

    expect(currentCalls.length).toBeGreaterThan(0)
    // Avant le correctif, le compteur restait à 0 (affichage « ··· ») jusqu'au rechargement.
    expect(result.current.countdown).toBeGreaterThan(30)
    expect(result.current.nextQuizRarity).toBe('épique')
  })

  it('un recalage en cours de cycle ne raccourcit PAS le cycle suivant', async () => {
    // Reliquat de 8 s au moment du recalage : il pilote la barre, mais ne doit jamais
    // devenir la durée de cycle de repli — sinon le compteur repart pour ~8 s juste
    // après une réponse (« il se lance une seconde fois de 10 sec »).
    currentImpl = async () => ({
      data: {
        quiz: null,
        next_quiz_at: new Date(Date.now() + 8_000).toISOString(),
        server_time:  new Date().toISOString(),
      },
      error: null,
    })

    const { result } = renderHook(() => useQuiz(OPTS))
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })
    expect(result.current.countdown).toBeGreaterThan(1)   // recalé sur les 8 s serveur

    // Le round suivant se termine sans horaire serveur exploitable (horaire dépassé,
    // quiz:solved manqué) : le repli doit valoir un CYCLE COMPLET, pas le reliquat de 8 s.
    currentImpl = () => new Promise(() => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    act(() => { result.current.advanceQuiz(Date.now()) })
    expect(result.current.countdown).toBeGreaterThan(30)
  })

  it('round multi-prix encore ouvert : aucun décompte fantôme après avoir pris son geocoin', async () => {
    // 2 geocoins à gagner, j'en prends 1 (final:false) : le round reste ouvert 20 s pour
    // le second. Le compteur ne doit PAS repartir sur l'estimation du quiz:new (il
    // entrerait dans ses 10 dernières secondes pendant que le round tourne encore).
    answerImpl = async () => ({
      data: {
        winner: true, card_earned: true, final: false, prizes_remaining: 1,
        grace_until: new Date(Date.now() + 20_000).toISOString(),
        server_time: new Date().toISOString(),
      },
      error: null,
    })

    const { result } = renderHook(() => useQuiz(OPTS))
    // Le round dure 55 s avant que je réponde : l'estimation posée au lancement
    // (60 s) est donc presque épuisée quand ma modale se referme.
    act(() => { result.current.setActiveQuiz({ id: 42, card: { id: 1, rarity: 'commun', name: 'X' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(55_000) })
    await act(async () => { await result.current.handleQuizAnswer('bonne réponse') })
    // Fermeture de la modale (2,2 s) → le compteur reprend la main.
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })

    // Le prochain quiz ne peut pas tomber avant la fin de la grâce (20 s) : le compteur
    // reste bien au-delà, donc jamais dans la zone « gros décompte » (≤ 10 s).
    expect(result.current.countdown).toBeGreaterThan(20)
  })

  it('relance le poll même si une requête reste en vol indéfiniment', async () => {
    currentImpl = () => new Promise(() => {})   // ne se règle jamais

    renderHook(() => useQuiz(OPTS))
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000) })
    expect(currentCalls.length).toBe(1)

    // Sans filet de sécurité, le verrou isFetching restait posé → plus AUCUN poll.
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(currentCalls.length).toBeGreaterThan(1)
  })
})
