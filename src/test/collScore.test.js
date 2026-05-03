import { describe, it, expect } from 'vitest'
import { collScore } from '../utils/gameUtils.js'

const pool = [
  { id: 1, rarity: 'commun' },
  { id: 2, rarity: 'rare' },
  { id: 3, rarity: 'épique' },
  { id: 4, rarity: 'légendaire' },
  { id: 5, rarity: 'commun' },
]

describe('collScore', () => {
  it('score vide = 0', () => expect(collScore({}, pool)).toBe(0))
  it('ignore quantity=0', () => expect(collScore({ 1: 0 }, pool)).toBe(0))
  it('commun = 1pt', () => expect(collScore({ 1: 1 }, pool)).toBe(1))
  it('rare = 3pts', () => expect(collScore({ 2: 1 }, pool)).toBe(3))
  it('épique = 7pts', () => expect(collScore({ 3: 1 }, pool)).toBe(7))
  it('légendaire = 20pts', () => expect(collScore({ 4: 1 }, pool)).toBe(20))
  it('cumule correctement', () => expect(collScore({ 1: 2, 2: 1 }, pool)).toBe(1 + 3))
  it('carte inconnue (absente du pool) = 0pt', () => expect(collScore({ 999: 1 }, pool)).toBe(0))
})
