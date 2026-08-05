/**
 * Génération du sitemap (scripts/lib/sitemap.mjs).
 *
 * L'enjeu principal est `<lastmod>` : Google cesse d'en tenir compte dès qu'il la
 * prend en défaut. Mieux vaut donc omettre la balise que la remplir au jugé.
 */
import { describe, it, expect } from 'vitest'
import { buildSitemap, lastmodOf, mostRecent } from '../../scripts/lib/sitemap.mjs'
import { SEO_LANGS } from '../seo/site.js'

describe('lastmodOf', () => {
  it('réduit un horodatage à la date W3C attendue', () => {
    expect(lastmodOf('2026-08-04T10:17:25.947+00:00')).toBe('2026-08-04')
    expect(lastmodOf(new Date('2026-08-04T23:00:00Z'))).toBe('2026-08-04')
  })

  it('renvoie null plutôt qu’une date inventée', () => {
    expect(lastmodOf(null)).toBeNull()
    expect(lastmodOf(undefined)).toBeNull()
    expect(lastmodOf('')).toBeNull()
    expect(lastmodOf('pas une date')).toBeNull()
  })
})

describe('mostRecent', () => {
  it('retient la date la plus récente et ignore les trous', () => {
    expect(mostRecent(['2026-01-02T00:00:00Z', null, '2026-08-04T00:00:00Z', undefined]))
      .toBe('2026-08-04T00:00:00Z')
    expect(mostRecent([])).toBeNull()
    expect(mostRecent(null)).toBeNull()
  })
})

describe('buildSitemap', () => {
  it('décline chaque entrée dans les quatre langues', () => {
    const xml = buildSitemap([{ route: 'faq' }])
    expect(xml.match(/<loc>/g)).toHaveLength(SEO_LANGS.length)
    expect(xml).toContain('<loc>https://geocoins.io/faq</loc>')
    expect(xml).toContain('<loc>https://geocoins.io/fr/faq</loc>')
  })

  it('pose des hreflang réciproques et un x-default sur chaque URL', () => {
    const xml = buildSitemap([{ route: 'faq' }])
    for (const block of xml.split('<url>').slice(1)) {
      expect(block.match(/hreflang=/g)).toHaveLength(SEO_LANGS.length + 1)
      expect(block).toContain('hreflang="x-default" href="https://geocoins.io/faq"')
    }
  })

  it('émet lastmod quand la date est connue', () => {
    const xml = buildSitemap([{ route: 'faq', lastmod: '2026-08-04T10:17:25Z' }])
    expect(xml.match(/<lastmod>2026-08-04<\/lastmod>/g)).toHaveLength(SEO_LANGS.length)
  })

  it('omet lastmod quand la date manque — API en retard, colonne absente', () => {
    expect(buildSitemap([{ route: 'faq' }])).not.toContain('<lastmod>')
    expect(buildSitemap([{ route: 'faq', lastmod: null }])).not.toContain('<lastmod>')
    expect(buildSitemap([{ route: 'faq', lastmod: 'jamais rempli' }])).not.toContain('<lastmod>')
  })

  it('compose les URLs à paramètre des fiches geocoin', () => {
    const xml = buildSitemap([{ route: 'geocoin', param: '12-original-stash', lastmod: '2026-08-05T09:00:00Z' }])
    expect(xml).toContain('<loc>https://geocoins.io/geocoins/12-original-stash</loc>')
    expect(xml).toContain('<loc>https://geocoins.io/de/geocoins/12-original-stash</loc>')
    expect(xml).toContain('<lastmod>2026-08-05</lastmod>')
  })

  it('produit un document valide même sans entrée', () => {
    const xml = buildSitemap([])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('</urlset>')
    expect(xml).not.toContain('<url>')
  })

  it('déclare l’espace de noms xhtml qu’exigent les hreflang', () => {
    expect(buildSitemap([{ route: 'home' }]))
      .toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  })
})
