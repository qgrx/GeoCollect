import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mock API : GET /api/quiz/current est piloté par le test (réponse « pas encore
// de quiz, prochain à telle heure », ou promesse qui ne se règle JAMAIS pour rejouer
// une requête perdue en vol sur mobile).
let currentImpl = async () => ({ data: null, error: null })
const currentCalls = []
vi.mock('../services/api.js', () => ({
  apiGetCurrentQuiz: vi.fn(() => { currentCalls.push(1); return currentImpl() }),
  apiJoinQuiz:       async () => ({ data: null, error: null }),
  apiAnswerQuiz:     async () => ({ data: null, error: null }),
}))

import { useQuiz } from '../hooks/useQuiz.js'

const OPTS = { profile: { id: 'u1', pseudo: 'Kosni' }, isDemo: false, limits: { quizInterval: 60 }, cardPool: [] }

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
