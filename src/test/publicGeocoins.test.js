import { describe, it, expect } from 'vitest'
import {
  isPublicGeocoin, publicGeocoins, relatedGeocoins,
  isIndexableGeocoin, MIN_INDEXABLE_DESCRIPTION, PUBLISHED_TYPES,
} from '../features/geocoins/publicGeocoins.js'

const long = 'x'.repeat(MIN_INDEXABLE_DESCRIPTION)

const pool = [
  { id: 3, name: 'Hommage à Groundspeak', type: 'Hommages', rarity: 'commun', description_long: '' },
  { id: 1, name: 'Original Stash',        type: 'Hommages', rarity: 'rare',   description_long: long },
  { id: 2, name: 'Mingo',                 type: 'Hommages', rarity: 'commun', description_long: '' },
  { id: 4, name: 'Slovaquie',             type: 'Pays',     rarity: 'commun', description_long: long },
  { id: 5, name: 'Fidèle',                type: 'Achievements', rarity: 'épique', description_long: long },
  { id: 6, name: 'Brouillon',             type: 'Hommages', rarity: 'commun', hidden: true },
]

describe('isPublicGeocoin', () => {
  it('ne publie que les types de la liste blanche', () => {
    expect(PUBLISHED_TYPES).toEqual(['Hommages'])
    expect(isPublicGeocoin(pool[0])).toBe(true)
  })

  it('exclut les types sans contenu propre — pays, achievements', () => {
    expect(isPublicGeocoin(pool[3])).toBe(false)
    expect(isPublicGeocoin(pool[4])).toBe(false)
  })

  it('exclut un type nouveau tant qu’il n’est pas explicitement autorisé', () => {
    expect(isPublicGeocoin({ id: 9, name: 'X', type: 'Nouveau type' })).toBe(false)
  })

  it('exclut une carte cachée, même si l’appelant fournit le pool admin', () => {
    expect(isPublicGeocoin(pool[5])).toBe(false)
  })

  it('exclut ce qui n’a ni id exploitable ni nom', () => {
    expect(isPublicGeocoin({ id: 'abc', name: 'x', type: 'Hommages' })).toBe(false)
    expect(isPublicGeocoin({ id: 1, name: '', type: 'Hommages' })).toBe(false)
    expect(isPublicGeocoin(null)).toBe(false)
  })
})

describe('publicGeocoins', () => {
  it('filtre, trie par id et attribue un slug', () => {
    const out = publicGeocoins(pool)
    expect(out.map(c => c.id)).toEqual([1, 2, 3])
    expect(out[0].slug).toBe('1-original-stash')
  })

  it('tolère une entrée non tableau', () => {
    expect(publicGeocoins(null)).toEqual([])
  })
})

describe('isIndexableGeocoin', () => {
  it('n’indexe qu’une fiche dotée d’une vraie description longue', () => {
    expect(isIndexableGeocoin(pool[1])).toBe(true)
    expect(isIndexableGeocoin(pool[0])).toBe(false)
    expect(isIndexableGeocoin({ description_long: 'trop court' })).toBe(false)
  })

  it('ne se laisse pas berner par la description COURTE de la carte', () => {
    // Elle est faite pour tenir sur une vignette : elle ne constitue pas une page.
    expect(isIndexableGeocoin({ type: 'Hommages', description: long, description_long: '' })).toBe(false)
  })

  it('tient compte de la traduction dans la langue par défaut', () => {
    expect(isIndexableGeocoin({ description_long: '', description_long_translations: { en: long } })).toBe(true)
  })
})

describe('relatedGeocoins', () => {
  it('met les fiches indexables en tête — c’est vers elles qu’on dirige les robots', () => {
    const out = relatedGeocoins(pool, pool[2])
    expect(isIndexableGeocoin(out[0])).toBe(true)
    expect(out[0].name).toBe('Original Stash')
  })

  it('n’inclut jamais la fiche elle-même et respecte la limite', () => {
    const out = relatedGeocoins(pool, pool[1], 1)
    expect(out).toHaveLength(1)
    expect(out.every(c => c.id !== 1)).toBe(true)
  })

  it('ne propose que des fiches publiables', () => {
    const out = relatedGeocoins(pool, pool[1], 10)
    expect(out.every(c => c.type === 'Hommages')).toBe(true)
  })

  it('renvoie une liste vide sans carte', () => {
    expect(relatedGeocoins(pool, null)).toEqual([])
  })
})
