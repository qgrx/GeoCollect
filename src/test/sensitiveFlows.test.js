import { describe, it, expect } from 'vitest'
import { countOwnedUnique, computeCardLimitStatus, computeStreakHandicap, isHandicapExemptCard, todayParis } from '../utils/gameUtils.js'
import { normalizeIntervalTiers, normalizePrizeTiers } from '../data/constants.js'

// ─── Comptage geocoins uniques ────────────────────────────────────────────────
describe('countOwnedUnique', () => {
  it('compte les entrées avec quantité > 0', () => {
    expect(countOwnedUnique({ 1: 1, 2: 3, 3: 1 })).toBe(3)
  })
  it('ignore les quantités nulles', () => {
    expect(countOwnedUnique({ 1: 0, 2: 2, 3: 0 })).toBe(1)
  })
  it('ne multiplie pas par la quantité (doublons = 1 geocoin)', () => {
    expect(countOwnedUnique({ 1: 9 })).toBe(1)
  })
  it('collection vide → 0', () => {
    expect(countOwnedUnique({})).toBe(0)
    expect(countOwnedUnique()).toBe(0)
  })
})

// ─── Cadence dynamique (normalisation des paliers) ──────────────────────────────
describe('normalizeIntervalTiers', () => {
  const DEFAULT = [{ players: 1, seconds: 300 }, { players: 2, seconds: 90 }, { players: 3, seconds: 60 }, { players: 4, seconds: 30 }]

  it('liste valide → triée', () => {
    expect(normalizeIntervalTiers([{ players: 2, seconds: 90 }, { players: 1, seconds: 300 }]))
      .toEqual([{ players: 1, seconds: 300 }, { players: 2, seconds: 90 }])
  })
  it('ancien format objet toléré (window_min ignoré)', () => {
    expect(normalizeIntervalTiers({ 1: 300, 2: 90, 3: 60, 4: 30, window_min: 10 })).toEqual(DEFAULT)
  })
  it('valeur invalide → défaut', () => {
    expect(normalizeIntervalTiers(null)).toEqual(DEFAULT)
    expect(normalizeIntervalTiers([])).toEqual(DEFAULT)
  })
})

// ─── Geocoins multiples (normalisation des paliers de prix) ─────────────────────
describe('normalizePrizeTiers', () => {
  const DEFAULT = [{ players: 10, prizes: 2 }, { players: 20, prizes: 3 }, { players: 30, prizes: 4 }]

  it('liste valide → triée par players', () => {
    expect(normalizePrizeTiers([{ players: 20, prizes: 3 }, { players: 10, prizes: 2 }]))
      .toEqual([{ players: 10, prizes: 2 }, { players: 20, prizes: 3 }])
  })
  it('ancien format objet toléré', () => {
    expect(normalizePrizeTiers({ 10: 2, 20: 3 })).toEqual([{ players: 10, prizes: 2 }, { players: 20, prizes: 3 }])
  })
  it('valeur invalide / hors bornes → défaut ou filtré', () => {
    expect(normalizePrizeTiers(null)).toEqual(DEFAULT)
    expect(normalizePrizeTiers([])).toEqual(DEFAULT)
    expect(normalizePrizeTiers([{ players: 0, prizes: 2 }, { players: 10, prizes: 2 }])).toEqual([{ players: 10, prizes: 2 }])
  })
})

// ─── Handicap anti-domination (miroir du backend) ──────────────────────────────
describe('computeStreakHandicap', () => {
  it('nul sous le seuil, progression puis plafond (défauts 3/1.5/8)', () => {
    expect(computeStreakHandicap(2)).toBe(0)
    expect(computeStreakHandicap(3)).toBe(1.5)
    expect(computeStreakHandicap(4)).toBe(3)
    expect(computeStreakHandicap(8)).toBe(8)
    expect(computeStreakHandicap(99)).toBe(8)
  })
  it('désactivé → 0', () => {
    expect(computeStreakHandicap(10, { enabled: false })).toBe(0)
  })
})

describe('isHandicapExemptCard', () => {
  it('légendaire (toujours) et épique brillante exemptées', () => {
    expect(isHandicapExemptCard('légendaire', false)).toBe(true)
    expect(isHandicapExemptCard('épique', true)).toBe(true)
  })
  it('épique non brillante / commun / rare non exemptées', () => {
    expect(isHandicapExemptCard('épique', false)).toBe(false)
    expect(isHandicapExemptCard('commun', true)).toBe(false)
    expect(isHandicapExemptCard('rare', false)).toBe(false)
  })
})

// ─── Reset des limites (affichage profil / bannière quiz) ───────────────────────
describe('computeCardLimitStatus', () => {
  const limits = { quizDailyCardCap: 70, quizHourlyCardCap: 20, quizDailyForgeCap: 200 }
  const today = todayParis()
  const minsAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()

  it('sous les limites → pas de blocage', () => {
    const s = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 5, hourly_cards: 3, cards_hour_reset_at: minsAgo(10) }, limits)
    expect(s.over).toBe(false)
  })

  it('limite quotidienne atteinte (prioritaire)', () => {
    const s = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 70, hourly_cards: 20, cards_hour_reset_at: minsAgo(10) }, limits)
    expect(s.over).toBe(true)
    expect(s.type).toBe('daily')
  })

  it('limite horaire atteinte (quotidien sous le cap)', () => {
    const s = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 30, hourly_cards: 20, cards_hour_reset_at: minsAgo(10) }, limits)
    expect(s.over).toBe(true)
    expect(s.type).toBe('hourly')
  })

  it('fenêtre horaire expirée (>60 min) → plus bloqué', () => {
    const s = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 30, hourly_cards: 20, cards_hour_reset_at: minsAgo(75) }, limits)
    expect(s.over).toBe(false)
  })

  it('nouveau jour → la fenêtre horaire est aussi réinitialisée (régression corrigée)', () => {
    // Veille : horaire au max, fenêtre récente (<60 min) ; mais daily_reset_at = hier
    const s = computeCardLimitStatus({ daily_reset_at: '2000-01-01', daily_cards: 70, hourly_cards: 20, cards_hour_reset_at: minsAgo(10) }, limits)
    expect(s.over).toBe(false) // nouveau jour → quotidien ET horaire repartent
  })

  it('forgeCapped reflète le cap quotidien de PF', () => {
    const capped = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 70, hourly_cards: 0, daily_forge_consolation: 200 }, limits)
    expect(capped.forgeCapped).toBe(true)
    const notCapped = computeCardLimitStatus({ daily_reset_at: today, daily_cards: 70, hourly_cards: 0, daily_forge_consolation: 50 }, limits)
    expect(notCapped.forgeCapped).toBe(false)
  })

  it('sac : les emplacements achetés relèvent la limite quotidienne (+1 chacun)', () => {
    const base = { daily_reset_at: today, daily_cards: 70, hourly_cards: 3, cards_hour_reset_at: minsAgo(10) }
    expect(computeCardLimitStatus(base, limits).type).toBe('daily')
    expect(computeCardLimitStatus({ ...base, bag_slots: 1 }, limits).over).toBe(false)
    // 70 + 2 slots = cap 72 → 71 cartes ne bloquent pas, 72 oui
    expect(computeCardLimitStatus({ ...base, daily_cards: 72, bag_slots: 2 }, limits).type).toBe('daily')
  })

  it('poches : le boost du jour relève la limite horaire jusqu\'à minuit', () => {
    const base = { daily_reset_at: today, daily_cards: 30, hourly_cards: 20, cards_hour_reset_at: minsAgo(10) }
    expect(computeCardLimitStatus(base, limits).type).toBe('hourly')
    const boosted = { ...base, pocket_boost: 10, pocket_boost_day: today }
    expect(computeCardLimitStatus(boosted, limits).over).toBe(false)
    // Boost de la veille : expiré, la limite horaire s'applique de nouveau
    const stale = { ...base, pocket_boost: 10, pocket_boost_day: '2000-01-01' }
    expect(computeCardLimitStatus(stale, limits).type).toBe('hourly')
  })

  it('cap à 0 = illimité : ni le sac ni le boost ne le transforment en limite', () => {
    const s = computeCardLimitStatus(
      { daily_reset_at: today, daily_cards: 999, hourly_cards: 999, cards_hour_reset_at: minsAgo(10), bag_slots: 5, pocket_boost: 10, pocket_boost_day: today },
      { quizDailyCardCap: 0, quizHourlyCardCap: 0 },
    )
    expect(s.over).toBe(false)
  })
})
