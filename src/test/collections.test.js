import { describe, it, expect } from 'vitest'
import { COLLECTIONS, collectionForDate, cardCollectionLabel } from '../data/collections.js'
import { geocoinDate } from '../features/geocoins/publicGeocoins.js'

describe('collections', () => {
  it('range dans Vanilla tout ce qui précède août 2026', () => {
    expect(collectionForDate('2026-04-28T07:46:03Z').code).toBe('vanilla')
    expect(collectionForDate('2026-07-31T23:59:59Z').code).toBe('vanilla')
  })

  it('laisse sans collection ce qui sort du calendrier, plutôt que d’inventer', () => {
    // Rien n'est encore défini après Vanilla : la fiche omettra la ligne.
    expect(collectionForDate('2026-08-01T00:00:00Z')).toBeNull()
    expect(collectionForDate(null)).toBeNull()
    expect(collectionForDate('pas une date')).toBeNull()
  })

  it('n’a aucun trou ni recouvrement entre collections', () => {
    for (let i = 1; i < COLLECTIONS.length; i++) {
      expect(COLLECTIONS[i].from).toBe(COLLECTIONS[i - 1].to)
    }
  })

  it('donne le libellé de la carte, vide si la date de publication manque', () => {
    expect(cardCollectionLabel({ published_at: '2026-05-01T00:00:00Z' }, 'de')).toBe('Vanilla')
    expect(cardCollectionLabel({ published_at: null }, 'fr')).toBe('')
    expect(cardCollectionLabel(undefined, 'fr')).toBe('')
  })
})

describe('geocoinDate', () => {
  it('formate dans la langue de la page', () => {
    expect(geocoinDate('2007-06-26', 'fr')).toBe('26 juin 2007')
    expect(geocoinDate('2007-06-26', 'en')).toBe('26 June 2007')
  })

  it('lit aussi un horodatage complet, et rend le même jour partout (UTC)', () => {
    expect(geocoinDate('2026-04-28T07:46:03.093Z', 'fr')).toBe('28 avril 2026')
    // Minuit UTC : au fuseau local d'un lecteur à l'ouest, ce serait la veille.
    expect(geocoinDate('2026-08-01T00:00:00Z', 'fr')).toBe('1 août 2026')
  })

  it('ne rend rien d’une date absente ou illisible', () => {
    expect(geocoinDate(null, 'fr')).toBe('')
    expect(geocoinDate('', 'fr')).toBe('')
    expect(geocoinDate('bientôt', 'fr')).toBe('')
  })
})
