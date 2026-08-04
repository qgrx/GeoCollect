import { describe, it, expect } from 'vitest'
import {
  parsePath, buildPath, alternatesFor, switchLangPath,
  geocoinSlug, geocoinIdFromSlug, INDEXABLE_ROUTES, LANG_CODES, DEFAULT_LANG,
} from '../routes.js'

describe('convention de langue', () => {
  it('sert l’anglais sans préfixe — c’est la langue par défaut', () => {
    expect(DEFAULT_LANG).toBe('en')
    expect(LANG_CODES[0]).toBe('en')
  })
})

describe('parsePath', () => {
  it('lit les routes anglaises sans préfixe', () => {
    expect(parsePath('/')).toEqual({ lang: 'en', route: 'home', param: null })
    expect(parsePath('/faq')).toEqual({ lang: 'en', route: 'faq', param: null })
    expect(parsePath('/release-notes')).toEqual({ lang: 'en', route: 'release-notes', param: null })
  })

  it('lit le préfixe des langues traduites, français compris', () => {
    expect(parsePath('/fr/faq')).toEqual({ lang: 'fr', route: 'faq', param: null })
    expect(parsePath('/de/')).toEqual({ lang: 'de', route: 'home', param: null })
    expect(parsePath('/es')).toEqual({ lang: 'es', route: 'home', param: null })
  })

  it('extrait l’identifiant d’un geocoin', () => {
    expect(parsePath('/geocoins/12-ftf')).toEqual({ lang: 'en', route: 'geocoin', param: '12-ftf' })
    expect(parsePath('/de/geocoins/12-ftf')).toEqual({ lang: 'de', route: 'geocoin', param: '12-ftf' })
  })

  it('refuse ce qui n’est pas une route connue', () => {
    expect(parsePath('/nimporte-quoi').route).toBeNull()
    expect(parsePath('/faq/trop/loin').route).toBeNull()
    // Segment en trop sur une route qui n’attend pas de paramètre : sinon deux URLs
    // distinctes serviraient la même page (duplicate content).
    expect(parsePath('/faq/12').route).toBeNull()
  })

  it('distingue la galerie des geocoins de la fiche d’un geocoin', () => {
    expect(parsePath('/geocoins')).toEqual({ lang: 'en', route: 'geocoins', param: null })
    expect(parsePath('/fr/geocoins')).toEqual({ lang: 'fr', route: 'geocoins', param: null })
    expect(parsePath('/geocoins/12-ftf')).toEqual({ lang: 'en', route: 'geocoin', param: '12-ftf' })
    expect(parsePath('/geocoins/12-ftf/trop-loin').route).toBeNull()
  })

  it('ne traite pas « /en » comme un préfixe : la langue par défaut n’en a pas', () => {
    expect(parsePath('/en').route).toBeNull()
    expect(parsePath('/en/faq').route).toBeNull()
  })
})

describe('buildPath', () => {
  it('omet le préfixe pour la langue par défaut', () => {
    expect(buildPath('home')).toBe('/')
    expect(buildPath('faq', { lang: 'en' })).toBe('/faq')
  })

  it('préfixe les langues traduites', () => {
    expect(buildPath('home', { lang: 'fr' })).toBe('/fr')
    expect(buildPath('support', { lang: 'de' })).toBe('/de/support')
  })

  it('compose les routes à paramètre', () => {
    expect(buildPath('geocoin', { param: '12-ftf' })).toBe('/geocoins/12-ftf')
    expect(buildPath('geocoin', { lang: 'es', param: '12-ftf' })).toBe('/es/geocoins/12-ftf')
  })

  it('retombe sur l’accueil pour une route inconnue', () => {
    expect(buildPath('inexistante')).toBe('/')
  })
})

describe('parsePath ∘ buildPath', () => {
  it('est une bijection sur toutes les routes indexables et toutes les langues', () => {
    for (const route of INDEXABLE_ROUTES) {
      const param = route === 'geocoin' ? '12-ftf' : null
      for (const lang of LANG_CODES) {
        expect(parsePath(buildPath(route, { lang, param }))).toEqual({ lang, route, param })
      }
    }
  })
})

describe('alternatesFor', () => {
  it('produit les quatre traductions d’une page pour les hreflang', () => {
    expect(alternatesFor('faq')).toEqual({
      en: '/faq', fr: '/fr/faq', de: '/de/faq', es: '/es/faq',
    })
  })
})

describe('switchLangPath', () => {
  it('reste sur la même page en changeant de langue', () => {
    expect(switchLangPath('/faq', 'de')).toBe('/de/faq')
    expect(switchLangPath('/fr/geocoins/12-ftf', 'en')).toBe('/geocoins/12-ftf')
    expect(switchLangPath('/fr/', 'es')).toBe('/es')
  })

  it('renvoie à l’accueil depuis une URL inconnue', () => {
    expect(switchLangPath('/nimporte-quoi', 'fr')).toBe('/fr')
  })
})

describe('geocoinSlug', () => {
  it('normalise accents, majuscules et ponctuation', () => {
    expect(geocoinSlug(7, 'Cache à Épreuves')).toBe('7-cache-a-epreuves')
    expect(geocoinSlug(7, 'FTF !')).toBe('7-ftf')
    expect(geocoinSlug(7, '  Ammo   Box  ')).toBe('7-ammo-box')
  })

  it('supporte un nom vide ou entièrement non latin', () => {
    expect(geocoinSlug(7, '')).toBe('7')
    expect(geocoinSlug(7, '???')).toBe('7')
  })

  it('ne laisse jamais de tiret final après troncature', () => {
    const slug = geocoinSlug(7, 'a'.repeat(58) + ' bcdef')
    expect(slug.endsWith('-')).toBe(false)
  })

  it('se relit : l’id est retrouvé quel que soit le libellé', () => {
    expect(geocoinIdFromSlug(geocoinSlug(1011, 'Geocoin brillant'))).toBe(1011)
    expect(geocoinIdFromSlug('42')).toBe(42)
    expect(geocoinIdFromSlug('ftf')).toBeNull()
    expect(geocoinIdFromSlug(null)).toBeNull()
  })
})
