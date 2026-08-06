import { describe, it, expect } from 'vitest'
import { collSectionOf, isFreshlyObtained, withSectionHeaders, splitSeenKeys, COLL_SECTION_ORDER } from '../utils/collectionDates.js'

// Référence : 15 août 2026, 10 h 00 locales.
const NOW = new Date(2026, 7, 15, 10, 0, 0).getTime()
const at = (y, m, d, h = 12) => new Date(y, m, d, h).toISOString()

describe('collSectionOf', () => {
  it('range le jour même dans « today », minuit compris', () => {
    expect(collSectionOf(at(2026, 7, 15, 9), NOW)).toBe('today')
    expect(collSectionOf(at(2026, 7, 15, 0), NOW)).toBe('today')
  })

  it('compare des JOURS, pas des tranches de 24 h', () => {
    // Hier 23 h 00 : moins de 24 h avant maintenant, mais c'est bien hier.
    expect(collSectionOf(at(2026, 7, 14, 23), NOW)).toBe('week')
  })

  it('découpe les bornes 7 et 30 jours', () => {
    expect(collSectionOf(at(2026, 7, 9), NOW)).toBe('week')    // J-6
    expect(collSectionOf(at(2026, 7, 8), NOW)).toBe('month')   // J-7
    expect(collSectionOf(at(2026, 6, 17), NOW)).toBe('month')  // J-29
    expect(collSectionOf(at(2026, 6, 16), NOW)).toBe('older')  // J-30
  })

  it('traite une date future comme « today » (horloge client décalée)', () => {
    expect(collSectionOf(at(2026, 7, 20), NOW)).toBe('today')
  })

  it('range les geocoins sans date exploitable avec les plus anciens', () => {
    expect(collSectionOf(null, NOW)).toBe('older')
    expect(collSectionOf(undefined, NOW)).toBe('older')
    expect(collSectionOf('pas une date', NOW)).toBe('older')
  })
})

describe('isFreshlyObtained', () => {
  it('couvre les 7 derniers jours et rien au-delà', () => {
    expect(isFreshlyObtained(at(2026, 7, 15), NOW)).toBe(true)
    expect(isFreshlyObtained(at(2026, 7, 9, 11), NOW)).toBe(true)
    expect(isFreshlyObtained(at(2026, 7, 1), NOW)).toBe(false)
  })

  it('ne date jamais un geocoin sans date', () => {
    expect(isFreshlyObtained(null, NOW)).toBe(false)
  })
})

describe('splitSeenKeys', () => {
  it('sépare geocoins normaux et brillants', () => {
    expect(splitSeenKeys(['12', '30_shiny', '7'])).toEqual({ cardIds: [12, 7], shinyIds: [30] })
  })

  it('ignore les clés illisibles laissées par une autre version', () => {
    expect(splitSeenKeys(['', 'abc', '0', '-3', null, undefined, '9'])).toEqual({ cardIds: [9], shinyIds: [] })
  })

  it('rend une liste vide sans rien à envoyer', () => {
    expect(splitSeenKeys([])).toEqual({ cardIds: [], shinyIds: [] })
  })
})

describe('withSectionHeaders', () => {
  // Liste telle que la produit le tri « Récents » : plus récent d'abord, les
  // geocoins sans date connue en toute fin.
  const items = [
    { id: 'a', at: at(2026, 7, 15) },
    { id: 'b', at: at(2026, 7, 12) },
    { id: 'c', at: at(2026, 6, 20) },
    { id: 'e', at: at(2026, 5, 1) },
    { id: 'd', at: null },
  ]

  it('insère un en-tête par section non vide, dans l’ordre', () => {
    const out = withSectionHeaders(items, NOW)
    expect(out.filter(x => x.__header).map(x => x.__header)).toEqual(['today', 'week', 'month', 'older'])
    // Chaque en-tête précède immédiatement son groupe ; les geocoins sans date
    // (« d ») ferment la section des plus anciens.
    expect(out.map(x => x.__header || x.id)).toEqual(['today', 'a', 'week', 'b', 'month', 'c', 'older', 'e', 'd'])
  })

  it('n’invente pas de section vide', () => {
    const out = withSectionHeaders([{ id: 'a', at: null }], NOW)
    expect(out).toEqual([{ __header: 'older' }, { id: 'a', at: null }])
  })

  it('conserve tous les éléments', () => {
    const out = withSectionHeaders(items, NOW)
    expect(out.filter(x => !x.__header)).toHaveLength(items.length)
  })

  it('regroupe même si la liste n’est pas triée', () => {
    const out = withSectionHeaders([items[2], items[0], items[1]], NOW)
    expect(out.map(x => x.__header || x.id)).toEqual(['today', 'a', 'week', 'b', 'month', 'c'])
  })

  it('COLL_SECTION_ORDER finit par les plus anciens', () => {
    expect(COLL_SECTION_ORDER[COLL_SECTION_ORDER.length - 1]).toBe('older')
  })
})
