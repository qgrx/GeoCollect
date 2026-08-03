import { describe, it, expect } from 'vitest'
import {
  isSaleRunning, saleDiscount, applyForgeSale, maxSaleDiscount,
  saleTimeLeft, formatSaleCountdown, MAX_SALE_PERCENT,
} from '../utils/forgeSale.js'

const T0 = Date.parse('2026-08-04T12:00:00.000Z')

const SALE = {
  active:    true,
  starts_at: '2026-08-04T10:00:00.000Z',
  ends_at:   '2026-08-04T14:00:00.000Z',
  shiny:     { commun: 50, rare: 50, épique: 50, légendaire: 50 },
  forge:     { commun: 0,  rare: 25, épique: 0,  légendaire: 0 },
}

describe('fenêtre des soldes', () => {
  it('bornes : début inclus, fin exclue', () => {
    expect(isSaleRunning(SALE, Date.parse('2026-08-04T10:00:00.000Z'))).toBe(true)
    expect(isSaleRunning(SALE, Date.parse('2026-08-04T14:00:00.000Z'))).toBe(false)
  })

  it('désactivé ou mal formé → pas de soldes', () => {
    expect(isSaleRunning(null, T0)).toBe(false)
    expect(isSaleRunning({ ...SALE, active: false }, T0)).toBe(false)
    expect(isSaleRunning({ ...SALE, ends_at: SALE.starts_at }, T0)).toBe(false)
  })
})

// Le prix affiché ici doit être IDENTIQUE à celui débité par l'API : ces
// attentes sont le miroir de src/test/forgeSale.test.js du repo geocards-api.
describe('prix soldé — miroir du calcul serveur', () => {
  it('remise appliquée, prix d\'origine conservé', () => {
    expect(applyForgeSale(1800, SALE, 'shiny', 'légendaire', T0))
      .toEqual({ cost: 900, original: 1800, discount: 50 })
  })

  it('barèmes indépendants par opération', () => {
    expect(saleDiscount(SALE, 'forge', 'légendaire', T0)).toBe(0)
    expect(saleDiscount(SALE, 'shiny', 'légendaire', T0)).toBe(50)
  })

  it('arrondi au PF le plus proche et plancher à 1', () => {
    expect(applyForgeSale(175, SALE, 'forge', 'rare', T0).cost).toBe(131)
    expect(applyForgeSale(1, { ...SALE, shiny: { commun: 95 } }, 'shiny', 'commun', T0).cost).toBe(1)
  })

  it('remise plafonnée', () => {
    expect(saleDiscount({ ...SALE, shiny: { commun: 100 } }, 'shiny', 'commun', T0)).toBe(MAX_SALE_PERCENT)
  })

  it('coût non configuré : null préservé (bouton Forger désactivé, pas « gratuit »)', () => {
    expect(applyForgeSale(null, SALE, 'shiny', 'commun', T0))
      .toEqual({ cost: null, original: null, discount: 0 })
  })

  it('hors fenêtre : plein tarif', () => {
    const after = Date.parse('2026-08-04T15:00:00.000Z')
    expect(applyForgeSale(1800, SALE, 'shiny', 'légendaire', after))
      .toEqual({ cost: 1800, original: 1800, discount: 0 })
  })
})

describe('bandeau', () => {
  it('annonce la plus forte remise des opérations visibles', () => {
    expect(maxSaleDiscount(SALE, ['shiny'], T0)).toBe(50)
    expect(maxSaleDiscount(SALE, ['forge'], T0)).toBe(25)
    expect(maxSaleDiscount(SALE, ['shiny', 'forge'], T0)).toBe(50)
  })

  it('rien à annoncer hors fenêtre', () => {
    expect(maxSaleDiscount(SALE, ['shiny'], Date.parse('2026-08-05T00:00:00Z'))).toBe(0)
  })

  it('temps restant nul hors soldes', () => {
    expect(saleTimeLeft(SALE, T0)).toBe(2 * 3600 * 1000)
    expect(saleTimeLeft(SALE, Date.parse('2026-08-05T00:00:00Z'))).toBe(0)
  })

  it('compte à rebours lisible', () => {
    expect(formatSaleCountdown(2 * 3600 * 1000 + 5000)).toBe('02:00:05')
    expect(formatSaleCountdown(50 * 3600 * 1000)).toBe('2 j 02:00')
    expect(formatSaleCountdown(-1)).toBe('00:00:00')
  })
})
