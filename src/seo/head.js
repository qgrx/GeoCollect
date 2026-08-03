/**
 * Fabrique le bloc `<head>` SEO d'une page : titre, description, URL canonique,
 * Open Graph, Twitter Card et JSON-LD.
 *
 * Fonction PURE renvoyant du HTML sous forme de chaîne — utilisée au build par le
 * plugin `injectSeo` de vite.config.js, et destinée à l'être aussi par le script
 * de pré-rendu des pages publiques. Une seule implémentation, donc aucun risque
 * que la coquille SPA et les pages pré-rendues divergent.
 */
import { SITE_URL, SITE_NAME, DEFAULT_LANG, abs } from './site.js'
import { ldScript } from './jsonld.js'

/** Locales Open Graph attendues par les crawlers sociaux (jamais le code court). */
const OG_LOCALE = { en: 'en_US', fr: 'fr_FR', de: 'de_DE', es: 'es_ES' }

/** Échappement pour valeur d'attribut HTML. */
export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const meta     = (name, content) => `<meta name="${name}" content="${esc(content)}" />`
const property = (prop, content) => `<meta property="${prop}" content="${esc(content)}" />`

/**
 * @param path        chemin absolu de la page sur le site (« / », « /faq »…)
 * @param image       chemin ou URL de l'image de partage ; rendue absolue si relative
 * @param alternates  map `{ lang: path }` pour les balises hreflang (phase multilingue)
 * @param jsonLd      blocs schema.org déjà construits (cf. seo/jsonld.js)
 */
export const DEFAULT_OG_IMAGE = '/og-image.png'

export function seoHead({
  lang = DEFAULT_LANG,
  path = '/',
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  ogType = 'website',
  noindex = false,
  alternates = null,
  jsonLd = [],
} = {}) {
  const url    = abs(path)
  const imgUrl = abs(image)
  const alt    = imageAlt ?? `Logo ${SITE_NAME}`

  const tags = [
    `<title>${esc(title)}</title>`,
    meta('description', description),
    `<link rel="canonical" href="${esc(url)}" />`,
  ]

  if (noindex) tags.push(meta('robots', 'noindex, follow'))

  // Dimensions connues seulement pour l'image par défaut (cf. scripts/gen-icons.mjs).
  // Les annoncer évite au crawler social un aller-retour avant d'afficher l'aperçu.
  const knownDims = image === DEFAULT_OG_IMAGE

  if (alternates) {
    for (const [l, p] of Object.entries(alternates)) {
      tags.push(`<link rel="alternate" hreflang="${esc(l)}" href="${esc(abs(p))}" />`)
    }
    // x-default = version servie à qui ne correspond à aucune langue déclarée.
    const fallbackPath = alternates[DEFAULT_LANG]
    if (fallbackPath) tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(abs(fallbackPath))}" />`)
  }

  tags.push(
    property('og:type', ogType),
    property('og:site_name', SITE_NAME),
    property('og:url', url),
    property('og:title', title),
    property('og:description', description),
    // URL ABSOLUE obligatoire : un og:image relatif est ignoré par tous les
    // crawlers sociaux. Et jamais de SVG — aucun ne le décode.
    property('og:image', imgUrl),
    property('og:image:alt', alt),
    ...(knownDims ? [property('og:image:width', 1200), property('og:image:height', 630)] : []),
    property('og:locale', OG_LOCALE[lang] ?? OG_LOCALE[DEFAULT_LANG]),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', title),
    meta('twitter:description', description),
    meta('twitter:image', imgUrl),
  )

  const ld = ldScript(...jsonLd)
  if (ld) tags.push(ld)

  return tags.join('\n    ')
}

export { SITE_URL, SITE_NAME }
