import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ─── Mock API : apiGetDailyQuests rend des promesses résolues manuellement, ce
// qui permet de rejouer l'ordre d'arrivée réseau exact du bug (réponse de
// démarrage qui aboutit APRÈS le rechargement post-action).
const questCalls = []
vi.mock('../services/api.js', () => {
  const okNull = async () => ({ data: null, error: null })
  return {
    apiGetCards:        async () => ({ data: { cards: [{ id: 1, name: 'A', type: 'T', rarity: 'commun' }] }, error: null }),
    apiGetCollection:   okNull,
    apiGetMarket:       okNull,
    apiGetMyListings:   okNull,
    apiBuyCard:         okNull,
    apiListCard:        okNull,
    apiCancelListing:   okNull,
    apiGetTransactions: okNull,
    apiPingProfile:     okNull,
    apiSetConfig:       okNull,
    apiGetAdminConfig:  okNull,
    apiGetPublicConfig: okNull,
    apiAdminGetCards:   okNull,
    apiAdminAddCard:    okNull,
    apiAdminEditCard:   okNull,
    apiAdminDeleteCard: okNull,
    apiAdminDeleteType: okNull,
    apiAdminRenameType: okNull,
    apiQuestCheckin:    okNull,
    apiGetAchievements: okNull,
    apiClaimReferral:   okNull,
    apiGetDailyQuests:  vi.fn(() => new Promise(resolve => questCalls.push(resolve))),
    // Quêtes hebdo : hors du champ de ce test (garde de séquence du quotidien) —
    // renvoie une liste vide immédiate pour ne pas déclencher de relance différée.
    apiGetWeeklyQuests: async () => ({ data: { quests: [], reroll_used: false }, error: null }),
    apiRerollWeeklyQuest: okNull,
  }
})

import { useGameState } from '../hooks/useGameState.js'

const STALE = [{ id: 9, name: 'Chasseur de trésor', type: 'daily_treasure', threshold: 1, progress: 0, completed_at: null, forge_points: 0, gold_reward: 50 }]
const FRESH = [{ ...STALE[0], progress: 1, completed_at: '2026-07-09T05:00:00.000Z' }]

// ─── refreshQuests : une réponse périmée n'écrase jamais une plus fraîche ─────
describe('refreshQuests — garde de séquence', () => {
  beforeEach(() => { questCalls.length = 0 })

  it("les réponses parties avant l'action de jeu n'écrasent pas la progression fraîche", async () => {
    const auth = { profile: { id: 'u1', gold: 0, forge_points: 0 } }
    const { result, unmount } = renderHook(() => useGameState(auth))

    // Démarrage : loadAll + chaîne check-in lancent chacun un fetch de quêtes
    await waitFor(() => expect(questCalls.length).toBe(2))
    const startupResolvers = questCalls.splice(0)

    // Action de jeu (ex. réclamer le trésor) → rechargement post-action
    act(() => { result.current.triggerQuestRefresh() })
    await waitFor(() => expect(questCalls.length).toBe(1))
    const postActionResolver = questCalls.splice(0)[0]

    // La réponse fraîche (quête complétée) arrive et s'applique
    await act(async () => { postActionResolver({ data: { quests: FRESH }, error: null }) })
    await waitFor(() => expect(result.current.quests).toEqual(FRESH))

    // …puis les réponses PÉRIMÉES du démarrage aboutissent : ignorées
    await act(async () => { for (const r of startupResolvers) r({ data: { quests: STALE }, error: null }) })
    expect(result.current.quests).toEqual(FRESH)

    unmount()
  })

  it('cas nominal : sans course, la dernière réponse est appliquée', async () => {
    const auth = { profile: { id: 'u2', gold: 0, forge_points: 0 } }
    const { result, unmount } = renderHook(() => useGameState(auth))

    await waitFor(() => expect(questCalls.length).toBe(2))
    // Les fetchs de démarrage aboutissent dans l'ordre → état initial 0/1
    await act(async () => { for (const r of questCalls.splice(0)) r({ data: { quests: STALE }, error: null }) })
    expect(result.current.quests).toEqual(STALE)

    act(() => { result.current.triggerQuestRefresh() })
    await waitFor(() => expect(questCalls.length).toBe(1))
    await act(async () => { questCalls.splice(0)[0]({ data: { quests: FRESH }, error: null }) })
    expect(result.current.quests).toEqual(FRESH)

    unmount()
  })
})

// ─── Bascule de minuit avec l'app au premier plan ────────────────────────────
// Ni montage, ni action de jeu, ni retour d'onglet : le joueur regarde l'écran
// à minuit. Sans le veilleur de date, la liste restait celle de la veille
// (trois quêtes « ✓ ») jusqu'au rechargement manuel.
describe('quêtes — changement de jour au premier plan', () => {
  beforeEach(() => { questCalls.length = 0 })
  afterEach(() => { vi.useRealTimers() })

  it('recharge les quêtes quand la date de Paris change, sans autre déclencheur', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T21:59:50Z'))   // 23:59:50 à Paris
    const auth = { profile: { id: 'u3', gold: 0, forge_points: 0 } }
    const { result, unmount } = renderHook(() => useGameState(auth))

    // Démarrage : on fait aboutir les fetchs sur la liste (complétée) de la veille
    for (let i = 0; i < 10 && questCalls.length < 2; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(questCalls.length).toBe(2)
    await act(async () => { for (const r of questCalls.splice(0)) r({ data: { quests: FRESH }, error: null }) })
    expect(result.current.quests).toEqual(FRESH)

    // Minuit franchi : le seul écoulement du temps doit relancer un fetch
    vi.setSystemTime(new Date('2026-08-01T22:00:10Z'))   // 00:00:10, jour suivant
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000 + 5_000) })
    expect(questCalls.length).toBeGreaterThan(0)

    // …et la liste du nouveau jour remplace bien celle de la veille
    await act(async () => { for (const r of questCalls.splice(0)) r({ data: { quests: STALE }, error: null }) })
    expect(result.current.quests).toEqual(STALE)

    unmount()
  })
})
