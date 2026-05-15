import { describe, it, expect } from 'vitest'
import { normA, wordCount, collScore, drawPackFromConfig, slotsToContents } from '../utils/gameUtils.js'

// ─── normA ────────────────────────────────────────────────────────────────────
describe('normA', () => {
  it('met en minuscules', () => expect(normA('PARIS')).toBe('paris'))
  it('retire les accents', () => {
    expect(normA('Éléphant')).toBe('elephant')
    expect(normA('Château')).toBe('chateau')
  })
  it('fusionne les mots avec tiret', () => expect(normA('Mont-Blanc!')).toBe('montblanc'))
  it('trim les espaces', () => expect(normA('  test  ')).toBe('test'))
})

// ─── wordCount ────────────────────────────────────────────────────────────────
describe('wordCount', () => {
  it('compte les mots', () => {
    expect(wordCount('bonjour le monde')).toBe(3)
    expect(wordCount('mot')).toBe(1)
  })
  it('retourne 0 pour chaîne vide', () => expect(wordCount('')).toBe(0))
})

// ─── collScore ────────────────────────────────────────────────────────────────
describe('collScore', () => {
  const pool = [
    { id: 1, rarity: 'commun' },
    { id: 2, rarity: 'rare' },
    { id: 3, rarity: 'épique' },
    { id: 4, rarity: 'légendaire' },
  ]

  it('calcule le score pondéré (1+3+7+20=31)', () => {
    expect(collScore({ 1: 1, 2: 1, 3: 1, 4: 1 }, pool)).toBe(31)
  })
  it('ignore les quantités zéro', () => expect(collScore({ 1: 0, 2: 1 }, pool)).toBe(3))
  it('retourne 0 pour collection vide', () => expect(collScore({}, pool)).toBe(0))
  it('double exemplaire ne change pas le score (carte déjà possédée)', () => {
    // collScore compte toutes les cartes avec quantité > 0, quantité > 1 ne multiplie pas
    expect(collScore({ 1: 2 }, pool)).toBe(1)
  })
})

// ─── drawPackFromConfig ───────────────────────────────────────────────────────
describe('drawPackFromConfig', () => {
  const pool = [
    { id: 1, rarity: 'commun',     type: 'Normal', forgeable: false },
    { id: 2, rarity: 'commun',     type: 'Normal', forgeable: false },
    { id: 3, rarity: 'rare',       type: 'Normal', forgeable: false },
    { id: 4, rarity: 'épique',     type: 'Normal', forgeable: false },
    { id: 5, rarity: 'légendaire', type: 'Normal', forgeable: false },
    { id: 6, rarity: 'commun',     type: 'Achievement', forgeable: false }, // exclu
    { id: 7, rarity: 'rare',       type: 'Normal', forgeable: true },       // exclu
  ]

  it('tire le bon nombre de cartes', () => {
    const slots = [{ rarity: 'commun', qty: 2 }, { rarity: 'rare', qty: 1 }]
    expect(drawPackFromConfig(pool, slots)).toHaveLength(3)
  })

  it('n\'inclut jamais de cartes forgeables ni achievements', () => {
    const slots = [{ rarity: 'commun', qty: 10 }]
    const cards = drawPackFromConfig(pool, slots)
    expect(cards.every(c => !c.forgeable && !c.type?.toLowerCase().startsWith('achievement'))).toBe(true)
  })

  it('respecte la rareté garantie', () => {
    const slots = [{ rarity: 'légendaire', qty: 1 }]
    const cards = drawPackFromConfig(pool, slots)
    expect(cards[0].rarity).toBe('légendaire')
  })

  it('slot alt : retourne rarity ou alt selon chance', () => {
    // chance=100 → toujours rarity principale
    const slots100 = [{ rarity: 'épique', alt: 'rare', chance: 100 }]
    expect(drawPackFromConfig(pool, slots100)[0].rarity).toBe('épique')
    // chance=0 → toujours alt
    const slots0 = [{ rarity: 'épique', alt: 'rare', chance: 0 }]
    expect(drawPackFromConfig(pool, slots0)[0].rarity).toBe('rare')
  })

  it('retourne un tableau vide pour des slots vides', () => {
    expect(drawPackFromConfig(pool, [])).toHaveLength(0)
  })
})

// ─── slotsToContents ─────────────────────────────────────────────────────────
describe('slotsToContents', () => {
  it('génère le libellé pour un slot garanti', () => {
    const contents = slotsToContents([{ rarity: 'commun', qty: 6 }])
    expect(contents[0].label).toMatch(/6/)
    expect(contents[0].label).toMatch(/Commun/i)
    expect(contents[0].icon).toBe('⚪')
  })

  it('génère le libellé avec note pour un slot alt', () => {
    const contents = slotsToContents([{ rarity: 'épique', alt: 'rare', chance: 50 }])
    expect(contents[0].label).toMatch(/Rare.+supérieure/i)
    expect(contents[0].note).toMatch(/50/)
    expect(contents[0].note).toMatch(/Épique/i)
  })

  it('retourne un tableau vide pour slots vides', () => {
    expect(slotsToContents([])).toHaveLength(0)
    expect(slotsToContents(null)).toHaveLength(0)
  })

  it('attribue la bonne icône selon la rareté', () => {
    const icons = slotsToContents([
      { rarity: 'commun' },
      { rarity: 'rare' },
      { rarity: 'épique' },
      { rarity: 'légendaire' },
    ]).map(c => c.icon)
    expect(icons).toEqual(['⚪', '🔵', '🟣', '🟠'])
  })
})
