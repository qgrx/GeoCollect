import { describe, it, expect } from 'vitest'
import { normalizeProfile } from '../utils/profile.js'
import { weekStartParis } from '../utils/gameUtils.js'

// Régression : SettingsModal lit `profile.weekly` / `profile.patronage`, or ces
// objets n'étaient construits que par le serveur — pas par le profil chargé en
// direct depuis Supabase. normalizeProfile doit TOUJOURS les produire.
describe('normalizeProfile — forme du profil', () => {
  it('renvoie tel quel une valeur vide', () => {
    expect(normalizeProfile(null)).toBe(null)
    expect(normalizeProfile(undefined)).toBe(undefined)
  })

  it('construit weekly/patronage depuis les colonnes plates (semaine courante)', () => {
    const p = normalizeProfile({
      weekly_rare: 3, weekly_epique: 2, weekly_legendaire: 1, weekly_reset_at: weekStartParis(),
      patronage_given_rare: 4, patronage_given_epique: 1, patronage_given_legendaire: 0,
      patronage_reset_at: weekStartParis(), patronage_count: 12,
    })
    expect(p.weekly).toEqual({ rare: 3, epique: 2, legendaire: 1 })
    expect(p.patronage).toEqual({ count: 12, given_rare: 4, given_epique: 1, given_legendaire: 0 })
  })

  it('remet les compteurs hebdo à 0 quand la semaine est périmée (mais garde le total mécène)', () => {
    const p = normalizeProfile({
      weekly_rare: 3, weekly_legendaire: 1, weekly_reset_at: '2000-01-03',
      patronage_given_rare: 4, patronage_reset_at: '2000-01-03', patronage_count: 12,
    })
    expect(p.weekly).toEqual({ rare: 0, epique: 0, legendaire: 0 })
    expect(p.patronage.given_rare).toBe(0)
    expect(p.patronage.count).toBe(12)   // le total offert ne se réinitialise jamais
  })

  it('expose toujours weekly/patronage même sans colonnes (defaults à 0)', () => {
    const p = normalizeProfile({ id: 'u1', pseudo: 'x' })
    expect(p.weekly).toEqual({ rare: 0, epique: 0, legendaire: 0 })
    expect(p.patronage).toEqual({ count: 0, given_rare: 0, given_epique: 0, given_legendaire: 0 })
  })

  it('dérive geocaching_verified de geocaching_verified_at', () => {
    expect(normalizeProfile({ geocaching_verified_at: '2026-01-01' }).geocaching_verified).toBe(true)
    expect(normalizeProfile({ geocaching_verified_at: null }).geocaching_verified).toBe(false)
  })
})

describe('weekStartParis — lundi de la semaine (Paris)', () => {
  it('renvoie le lundi même quand la date est déjà un lundi', () => {
    // 2024-01-01 est un lundi.
    expect(weekStartParis(new Date('2024-01-01T12:00:00Z'))).toBe('2024-01-01')
  })

  it('recule au lundi depuis un jour de milieu de semaine', () => {
    // 2024-01-04 est un jeudi → lundi = 2024-01-01.
    expect(weekStartParis(new Date('2024-01-04T12:00:00Z'))).toBe('2024-01-01')
  })

  it('renvoie toujours un lundi', () => {
    const ws = weekStartParis(new Date('2026-07-24T10:00:00Z'))
    expect(new Date(ws + 'T12:00:00Z').getUTCDay()).toBe(1)   // 1 = lundi
  })
})
