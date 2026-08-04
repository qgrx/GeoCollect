import { describe, it, expect } from 'vitest'
import { GEOCACHE_TYPES, GEOCACHE_TYPE_GROUPS, geocacheTypeLabel, gcCodeFromInput, gcCodeIssue, gcCodeUrl, isTributeCard } from '../data/geocaching.js'
import { PUBLISHED_TYPES } from '../features/geocoins/publicGeocoins.js'

describe('types de caches', () => {
  it('n’a pas de code en double et range chaque type dans un groupe connu', () => {
    const codes = GEOCACHE_TYPES.map(t => t.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const t of GEOCACHE_TYPES) expect(GEOCACHE_TYPE_GROUPS).toContain(t.group)
  })

  it('est traduit dans les 4 langues du site — la fiche publique n’est pas qu’en français', () => {
    for (const t of GEOCACHE_TYPES) {
      for (const lang of ['fr', 'en', 'de', 'es']) {
        expect(t.label[lang], `${t.code}/${lang}`).toBeTruthy()
      }
    }
  })

  it('affiche un libellé, et le code brut si le type vient d’ailleurs', () => {
    expect(geocacheTypeLabel('traditional')).toBe('Cache traditionnelle')
    expect(geocacheTypeLabel('traditional', 'en')).toBe('Traditional Cache')
    // Langue inconnue → français, la langue de rédaction : jamais une case vide.
    expect(geocacheTypeLabel('traditional', 'it')).toBe('Cache traditionnelle')
    expect(geocacheTypeLabel('inconnu_du_front')).toBe('inconnu_du_front')
    expect(geocacheTypeLabel(null)).toBe('')
  })
})

describe('geocoins d’hommage', () => {
  // Les deux listes disent la même chose — « ce geocoin parle d'une cache réelle » —
  // et doivent le dire du même type, sinon un geocoin publié n'aurait pas de champ
  // de saisie, ou l'inverse.
  it('vise les mêmes types que ceux qui ont une page publique', () => {
    for (const type of PUBLISHED_TYPES) expect(isTributeCard({ type })).toBe(true)
    expect(isTributeCard({ type: 'Pays' })).toBe(false)
    expect(isTributeCard(null)).toBe(false)
  })
})

describe('code GC', () => {
  it('normalise la saisie comme le fait l’API', () => {
    expect(gcCodeFromInput(' gc1a2b3 ')).toBe('GC1A2B3')
    expect(gcCodeFromInput('https://coord.info/GC1234')).toBe('GC1234')
    expect(gcCodeFromInput('https://www.geocaching.com/geocache/GCABCD_ma-cache')).toBe('GCABCD')
    expect(gcCodeFromInput('')).toBeNull()
    expect(gcCodeFromInput('sais plus')).toBeNull()
  })

  it('ne signale que ce que l’admin peut corriger', () => {
    expect(gcCodeIssue('')).toBeNull()
    expect(gcCodeIssue('GC1A2B3')).toBeNull()
    expect(gcCodeIssue('https://coord.info/GC1234')).toBeNull()   // lien : l'API extrait
    expect(gcCodeIssue('1A2B3')).toBeTruthy()
  })

  it('construit le lien officiel de la cache', () => {
    expect(gcCodeUrl('gc1234')).toBe('https://coord.info/GC1234')
    expect(gcCodeUrl('')).toBeNull()
  })
})
