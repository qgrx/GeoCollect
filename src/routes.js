/**
 * Table des routes de la SPA et traduction chemin ⇄ route.
 *
 * Module PUR et sans dépendance React : il est importé aussi bien par
 * l'application que par les scripts Node de génération (pré-rendu, sitemap), qui
 * doivent produire exactement les mêmes URLs que celles que le client sait lire.
 *
 * Convention d'URL — l'anglais est la langue par défaut, canonique et sans
 * préfixe ; les autres langues, français compris, sont préfixées :
 *
 *     /                /faq        /release-notes      /geocoins/12-ftf
 *     /fr/  /de/  /es/  …/faq       …/release-notes      …/geocoins/12-ftf
 *
 * Sans ces préfixes, la langue vivant uniquement dans localStorage, une seule des
 * quatre traductions était atteignable par une URL — donc indexable.
 */
import { SEO_LANGS, DEFAULT_LANG } from './seo/site.js'

export { DEFAULT_LANG }
export const LANG_CODES = SEO_LANGS

/**
 * `segment` : premier segment d'URL après l'éventuel préfixe de langue.
 * `param`   : la route accepte un segment supplémentaire (identifiant).
 * `indexable` : présence dans le sitemap et absence de `noindex`.
 */
export const ROUTES = {
  home:            { segment: '',              indexable: true },
  faq:             { segment: 'faq',           indexable: true },
  'release-notes': { segment: 'release-notes', indexable: true },
  support:         { segment: 'support',       indexable: true },
  geocoin:         { segment: 'geocoins',      indexable: true, param: true },
  admin:           { segment: 'admin',         indexable: false },
}

/** Routes destinées aux moteurs, dans l'ordre d'importance du sitemap. */
export const INDEXABLE_ROUTES = Object.keys(ROUTES).filter(r => ROUTES[r].indexable)

/** Routes servies par la couche « docs » (DocsLayout). */
export const DOCS_ROUTES = ['release-notes', 'faq', 'support']

const BY_SEGMENT = Object.fromEntries(
  Object.entries(ROUTES).map(([name, def]) => [def.segment, name]),
)

/**
 * Découpe un chemin en `{ lang, route, param }`.
 * `route` vaut `null` si le chemin ne correspond à aucune route connue — c'est ce
 * qui doit produire un 404, et non un rendu d'accueil silencieux.
 */
export function parsePath(pathname = '/') {
  const parts = String(pathname).split('/').filter(Boolean)

  let lang = DEFAULT_LANG
  if (parts.length && LANG_CODES.includes(parts[0]) && parts[0] !== DEFAULT_LANG) {
    lang = parts.shift()
  }

  const segment = parts.shift() ?? ''
  const route   = BY_SEGMENT[segment]
  if (route === undefined) return { lang, route: null, param: null }

  const def   = ROUTES[route]
  const param = parts.shift() ?? null

  // Segment surnuméraire, ou identifiant fourni à une route qui n'en attend pas :
  // deux URLs distinctes ne doivent jamais servir le même contenu.
  if (parts.length) return { lang, route: null, param: null }
  if (param && !def.param) return { lang, route: null, param: null }
  if (!param && def.param) return { lang, route: null, param: null }

  return { lang, route, param }
}

/** Chemin canonique d'une route. Réciproque exacte de `parsePath`. */
export function buildPath(route, { lang = DEFAULT_LANG, param = null } = {}) {
  const def = ROUTES[route]
  if (!def) return '/'
  const prefix = lang && lang !== DEFAULT_LANG && LANG_CODES.includes(lang) ? `/${lang}` : ''
  const parts  = [def.segment, def.param ? param : null].filter(Boolean)
  if (parts.length) return `${prefix}/${parts.join('/')}`
  // Accueil : « / » dans la langue par défaut, « /fr » ailleurs. Pas de slash
  // final — il doit exister UNE seule forme, sinon l'URL canonique déclarée
  // subit une redirection.
  return prefix || '/'
}

/** Map `{ lang: chemin }` de toutes les traductions d'une page, pour les hreflang. */
export function alternatesFor(route, param = null) {
  return Object.fromEntries(LANG_CODES.map(lang => [lang, buildPath(route, { lang, param })]))
}

/** Même page, autre langue — utilisé au changement de langue depuis l'interface. */
export function switchLangPath(pathname, lang) {
  const { route, param } = parsePath(pathname)
  if (!route) return buildPath('home', { lang })
  return buildPath(route, { lang, param })
}

// ─── Geocoins ─────────────────────────────────────────────────────────────────

/**
 * Identifiant d'URL d'un geocoin : `<id>-<nom normalisé>`.
 * L'id porte l'unicité (deux geocoins peuvent partager un nom) et le libellé n'est
 * là que pour la lisibilité — d'où une résolution qui ne lit QUE l'id.
 */
export function geocoinSlug(id, name = '') {
  const slug = String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')          // diacritiques isolés par la décomposition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')              // la troncature peut laisser un tiret orphelin
  return slug ? `${id}-${slug}` : String(id)
}

/** Id contenu dans un slug de geocoin, ou `null` si le segment est illisible. */
export function geocoinIdFromSlug(slug) {
  const m = /^(\d+)(?:-|$)/.exec(String(slug ?? ''))
  return m ? Number(m[1]) : null
}
