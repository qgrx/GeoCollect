import { describe, it, expect } from 'vitest'
import { normA, wordCount, collScore } from '../utils/gameUtils.js'

describe('normA', () => {
  it('normalise en minuscules sans accents', () => {
    expect(normA('Éléphant')).toBe('elephant')
  })
  it('supprime la ponctuation', () => {
    expect(normA('Mont-Blanc!')).toBe('montblanc')
  })
  it('trim les espaces', () => {
    expect(normA('  test  ')).toBe('test')
  })
})

describe('wordCount', () => {
  it('compte les mots', () => {
    expect(wordCount('bonjour le monde')).toBe(3)
    expect(wordCount('mot')).toBe(1)
    expect(wordCount('')).toBe(0)
  })
})

describe('collScore', () => {
  const cardPool = [
    { id: 1, rarity: 'commun' },
    { id: 2, rarity: 'rare' },
    { id: 3, rarity: 'épique' },
    { id: 4, rarity: 'légendaire' },
  ]

  it('calcule le score pondéré', () => {
    const col = { 1: 1, 2: 1, 3: 1, 4: 1 }
    // commun=1, rare=3, épique=7, légendaire=20 → total=31
    expect(collScore(col, cardPool)).toBe(31)
  })

  it('ignore les quantités zéro', () => {
    const col = { 1: 0, 2: 1 }
    expect(collScore(col, cardPool)).toBe(3)
  })

  it('retourne 0 pour une collection vide', () => {
    expect(collScore({}, cardPool)).toBe(0)
  })
})
