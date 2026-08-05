/**
 * Génération du sitemap XML.
 *
 * Extrait de prerender.mjs pour être testable : ce script fait des appels réseau
 * au chargement et ne peut pas être importé depuis un test.
 *
 * Chaque entrée est déclinée dans les quatre langues, avec les `hreflang`
 * réciproques et un `x-default` vers la langue par défaut.
 */
import { abs, SEO_LANGS, DEFAULT_LANG } from '../../src/seo/site.js'
import { alternatesFor } from '../../src/routes.js'

// La galerie change à chaque geocoin publié, et c'est la porte d'entrée vers
// toutes les fiches : juste derrière l'accueil.
export const CHANGEFREQ = { home: 'daily', geocoins: 'weekly', 'release-notes': 'weekly', faq: 'monthly', support: 'monthly' }
export const PRIORITY   = { home: '1.0', geocoins: '0.9', 'release-notes': '0.7', faq: '0.7', support: '0.5' }

/**
 * Horodatage → date W3C `AAAA-MM-JJ` attendue par `<lastmod>`.
 *
 * Renvoie `null` sur une valeur absente ou illisible, auquel cas la balise est
 * simplement omise. C'est volontaire : Google cesse de tenir compte de `lastmod`
 * dès qu'il la prend en défaut, donc pas de date vaut mieux qu'une date fausse.
 * Le jour suffit — prétendre à la seconde près n'apporte rien.
 */
export function lastmodOf(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** @param entries liste `{ route, param?, lastmod? }` */
export function buildSitemap(entries) {
  const urls = (entries ?? []).map(({ route, param = null, lastmod = null }) => {
    const alts  = alternatesFor(route, param)
    const stamp = lastmodOf(lastmod)
    return SEO_LANGS.map(lang => [
      '  <url>',
      `    <loc>${abs(alts[lang])}</loc>`,
      ...SEO_LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(alts[l])}" />`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(alts[DEFAULT_LANG])}" />`,
      ...(stamp ? [`    <lastmod>${stamp}</lastmod>`] : []),
      `    <changefreq>${CHANGEFREQ[route] ?? 'monthly'}</changefreq>`,
      `    <priority>${PRIORITY[route] ?? '0.6'}</priority>`,
      '  </url>',
    ].join('\n')).join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

/** Date la plus récente d'une liste d'horodatages, `null` si aucune. */
export function mostRecent(values) {
  return (values ?? []).filter(Boolean).sort().at(-1) ?? null
}
