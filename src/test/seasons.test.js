import { describe, it, expect } from 'vitest'
import { seasonColor, seasonTextColor, seasonsById, seasonName } from '../data/seasons.js'

describe('seasonName', () => {
  const season = { id: 1, name: 'Saison Été 2026', name_translations: { en: 'Summer 2026', de: '', es: 'Verano 2026' } }

  it('affiche la traduction quand elle existe', () => {
    expect(seasonName(season, 'en')).toBe('Summer 2026')
    expect(seasonName(season, 'es')).toBe('Verano 2026')
  })

  it('retombe sur le français — langue source — sinon', () => {
    expect(seasonName(season, 'fr')).toBe('Saison Été 2026')
    expect(seasonName(season, 'de')).toBe('Saison Été 2026')   // traduction vide
    expect(seasonName({ id: 2, name: 'Hiver' }, 'en')).toBe('Hiver')  // colonne absente
  })

  it('ne casse pas sans saison', () => {
    expect(seasonName(null, 'en')).toBe('')
  })
})

describe('seasonColor — indépendance de la langue', () => {
  it('garde la couleur du nom SOURCE, quelle que soit la langue affichée', () => {
    const noel = { id: 5, name: 'Noël 2026', name_translations: { en: 'Christmas 2026' } }
    expect(seasonColor(noel)).toBe(seasonColor({ id: 5, name: 'Noël 2026' }))
  })
})

describe('seasonColor', () => {
  it('donne la même couleur à une saison, quels que soient l\'écran et la session', () => {
    const season = { id: 42, name: 'Saison des cachettes' }
    expect(seasonColor(season)).toBe(seasonColor({ ...season }))
  })

  it('reconnaît les saisons thématiques dans les quatre langues du jeu', () => {
    const noel = seasonColor({ id: 1, name: 'Noël 2026' })
    expect(seasonColor({ id: 7, name: 'Christmas 2026' })).toBe(noel)
    expect(seasonColor({ id: 8, name: 'Weihnachten 2026' })).toBe(noel)
    expect(seasonColor({ id: 9, name: 'Navidad 2026' })).toBe(noel)
  })

  it('distingue deux saisons quelconques voisines', () => {
    expect(seasonColor({ id: 3, name: 'Vague A' })).not.toBe(seasonColor({ id: 4, name: 'Vague B' }))
  })

  it('ne casse pas sur une saison absente ou un id non numérique', () => {
    expect(seasonColor(null)).toMatch(/^#[0-9a-f]{6}$/i)
    expect(seasonColor({ id: 'x', name: '' })).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('seasonTextColor', () => {
  it('passe au texte sombre sur une couleur claire', () => {
    expect(seasonTextColor('#f9ca24')).toBe('#1e3045')
    expect(seasonTextColor('#0984e3')).toBe('#fff')
  })

  it('retombe sur le blanc si la couleur est illisible', () => {
    expect(seasonTextColor(undefined)).toBe('#fff')
  })
})

describe('seasonsById', () => {
  it('indexe les saisons et ignore les entrées sans id', () => {
    const map = seasonsById([{ id: 2, name: 'Été' }, null, { name: 'sans id' }])
    expect(map[2].name).toBe('Été')
    expect(Object.keys(map)).toHaveLength(1)
  })
})
