/**
 * Pré-rendu des pages publiques + génération du sitemap, après `vite build`.
 *
 *   npm run build   →   vite build && node scripts/prerender.mjs
 *
 * Pourquoi : la SPA sert un `index.html` unique dont le `<div id="root">` est vide.
 * Un moteur y voit une page sans titre propre, sans URL canonique et sans le
 * moindre texte — le contenu n'arrivant qu'après exécution du JS puis appel API.
 * Ce script écrit, pour chaque route publique et chaque langue, un vrai fichier
 * HTML : métadonnées spécifiques, hreflang réciproques, JSON-LD, et le contenu
 * éditorial en HTML sémantique. React le remplace à l'hydratation par la version
 * live : robots et visiteurs voient la même chose.
 *
 * Si l'API est injoignable, on émet des coquilles « métadonnées seules » avec un
 * avertissement bien visible : une API en panne ne doit pas bloquer un déploiement.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')

// DOMPurify a besoin d'un DOM. Poser `window` AVANT d'importer sanitize.js permet
// de réutiliser telle quelle l'allowlist de l'application plutôt que d'en tenir
// une seconde, qui divergerait.
const dom = new JSDOM('')
globalThis.window   = dom.window
globalThis.document = dom.window.document

const { sanitizeHtml, neutralizeDarkText } = await import('../src/utils/sanitize.js')
const { renderDocsPage, PRERENDER_STYLE, escapeText, excerpt } = await import('./lib/renderDocs.mjs')
const { seoHead } = await import('../src/seo/head.js')
const { seoCopy } = await import('../src/seo/copy.js')
const { organizationLd, websiteLd, videoGameLd, faqPageLd, geocoinLd } = await import('../src/seo/jsonld.js')
const { abs, SEO_LANGS, DEFAULT_LANG, SOURCE_LANG } = await import('../src/seo/site.js')
const { buildPath, alternatesFor, DOCS_ROUTES } = await import('../src/routes.js')
const { TRANSLATIONS } = await import('../src/i18n/translations.js')
const { cardName, cardLongDescription, typeLabel, RARITY_CONFIG } = await import('../src/data/cards.js')
const { publicGeocoins, relatedGeocoins, isIndexableGeocoin, MIN_INDEXABLE_DESCRIPTION } =
  await import('../src/features/geocoins/publicGeocoins.js')

const API = (process.env.VITE_API_URL || '').replace(/\/$/, '')

const sanitize = (html) => sanitizeHtml(neutralizeDarkText(html))
// Même chaîne de repli que l'application : langue → défaut → langue de rédaction.
const tr = (lang, key) =>
  TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS[DEFAULT_LANG]?.[key] ?? TRANSLATIONS[SOURCE_LANG]?.[key] ?? ''

let warnings = 0
const warn = (msg) => { warnings++; console.warn(`⚠️  ${msg}`) }

// ─── Récupération du contenu ──────────────────────────────────────────────────

async function apiGet(pathname) {
  if (!API) return null
  try {
    const res = await fetch(`${API}${pathname}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) { warn(`${pathname} → HTTP ${res.status}`); return null }
    return await res.json()
  } catch (err) {
    warn(`${pathname} injoignable (${err.message})`)
    return null
  }
}

/** Config publique : onglets docs masqués et traductions des types de geocoin. */
async function fetchPublicConfig() {
  const json = await apiGet('/api/config')
  return json?.data?.config ?? json?.config ?? {}
}

async function fetchDocs(page, lang) {
  const json = await apiGet(`/api/docs/${page}?lang=${lang}`)
  let content = json?.data?.content ?? json?.content ?? null
  // Tolérance : un backend renvoyant la map { en, fr… } au lieu d'une seule langue.
  if (content && !Array.isArray(content) && typeof content === 'object') {
    content = content[lang] ?? content[DEFAULT_LANG] ?? content[SOURCE_LANG] ?? null
  }
  return Array.isArray(content) ? content : null
}

// ─── Écriture des pages ───────────────────────────────────────────────────────

const shell = await fs.readFile(path.join(DIST, 'index.html'), 'utf8')

// L'accueil dans la langue par défaut EST dist/index.html : ce script écrase donc sa propre
// coquille et n'est pas rejouable seul. C'est voulu — il tourne juste après
// `vite build`, qui la régénère.
if (!/<!--seo:start-->[\s\S]*<!--seo:end-->/.test(shell)) {
  throw new Error(
    'Bornes <!--seo:start/end--> absentes de dist/index.html.\n' +
    'Relancer `vite build` d’abord : le pré-rendu consomme la coquille et ne peut pas être rejoué seul.',
  )
}

/** Compose un fichier HTML complet à partir de la coquille produite par Vite. */
function page({ lang, head, body }) {
  return shell
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/<!--seo:start-->[\s\S]*<!--seo:end-->/, `${head}\n    ${PRERENDER_STYLE}`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

async function writePage(routePath, html) {
  const dir = path.join(DIST, routePath.replace(/^\/|\/$/g, ''))
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), html)
}

// ─── Accueil ──────────────────────────────────────────────────────────────────

/** Contenu d'accroche de l'accueil, repris des traductions déjà écrites. */
function homeBody(lang, hidden) {
  const benefits = [1, 2, 3]
    .map(i => `<section><h2>${escapeText(tr(lang, `landing_benefit${i}_title`))}</h2><p>${escapeText(tr(lang, `landing_benefit${i}_body`))}</p></section>`)
    .join('\n')
  // Ne jamais lier une page masquée par un admin : elle n'est pas publiée, donc 404.
  const links = DOCS_ROUTES
    .filter(r => !hidden.includes(r))
    .map(r => `<li><a href="${buildPath(r, { lang })}">${escapeText(tr(lang, `docs_nav_${r === 'release-notes' ? 'release' : r}`))}</a></li>`)
    .join('')
  return `<main class="prerendered">
<h1>${escapeText(tr(lang, 'landing_hero_title'))}</h1>
<p>${escapeText(tr(lang, 'landing_hero_sub'))}</p>
${benefits}
<nav><ul>${links}</ul></nav>
</main>`
}

async function buildHome(lang, hidden) {
  const { title, description } = seoCopy('home', lang)
  const head = seoHead({
    lang,
    path: buildPath('home', { lang }),
    title,
    description,
    alternates: alternatesFor('home'),
    jsonLd: [organizationLd(), websiteLd(), videoGameLd({ description, lang })],
  })
  await writePage(buildPath('home', { lang }), page({ lang, head, body: homeBody(lang, hidden) }))
}

// ─── Pages docs ───────────────────────────────────────────────────────────────

const DOC_HEADING_KEY = {
  'release-notes': 'docs_release_title',
  faq: 'docs_nav_faq',
  support: 'docs_nav_support',
}

async function buildDocs(route, lang, content) {
  const heading = tr(lang, DOC_HEADING_KEY[route])
  const { html, text } = content
    ? renderDocsPage({ page: route, content, heading, sanitize })
    : { html: '', text: '' }

  const description = text || seoCopy('home', lang).description
  const head = seoHead({
    lang,
    path: buildPath(route, { lang }),
    title: `${heading} — Geocoins`,
    description: excerpt(description),
    ogType: route === 'release-notes' ? 'article' : 'website',
    alternates: alternatesFor(route),
    jsonLd: route === 'faq'
      ? [faqPageLd(content, { url: abs(buildPath(route, { lang })) })].filter(Boolean)
      : [],
  })
  await writePage(buildPath(route, { lang }), page({ lang, head, body: html }))
  return !!html
}

// ─── Fiches geocoin ───────────────────────────────────────────────────────────

/**
 * Texte libre saisi par un admin → paragraphes HTML. Les descriptions longues
 * sont écrites dans un simple textarea : leurs sauts de ligne portent la
 * structure, et les perdre transformerait le texte en un unique pavé.
 */
function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeText(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

const rarityLabelFor = (rarity, lang) => {
  const rc = RARITY_CONFIG[rarity]
  return rc ? (tr(lang, rc.labelKey) || rc.label) : rarity
}

async function buildGeocoin(card, related, lang) {
  const name  = cardName(card, lang)
  const desc  = cardLongDescription(card, lang)
  const rar   = rarityLabelFor(card.rarity, lang)
  const type  = typeLabel(card.type, typeTranslations, lang)
  const path  = buildPath('geocoin', { lang, param: card.slug })
  const links = related
    .map(c => `<li><a href="${buildPath('geocoin', { lang, param: c.slug })}">${escapeText(cardName(c, lang))}</a></li>`)
    .join('')

  const body = `<main class="prerendered">
<h1>${escapeText(name)}</h1>
${card.image_url ? `<img src="${escapeText(card.image_url)}" alt="${escapeText(name)}" width="320" height="320" />` : ''}
<p>${escapeText(rar)}${type ? ` · ${escapeText(type)}` : ''}</p>
${paragraphs(desc)}
${links ? `<nav><h2>${escapeText(tr(lang, 'geocoin_related'))}</h2><ul>${links}</ul></nav>` : ''}
</main>`

  // Description : le texte du geocoin s'il existe, sinon une phrase factuelle —
  // jamais la description générique du site, qui produirait des centaines de
  // pages aux métadonnées identiques.
  const description = excerpt(desc || `${name} — ${rar}${type ? ` · ${type}` : ''}`)

  const head = seoHead({
    lang,
    path,
    title: `${name} — ${rar} — Geocoins`.slice(0, 70),
    description,
    // L'image du geocoin plutôt que le logo : le partage montre l'objet lui-même.
    image: card.image_url || undefined,
    imageAlt: name,
    // Fiche sans description réelle : servie et suivable, mais pas soumise à
    // l'index — cf. MIN_INDEXABLE_DESCRIPTION.
    noindex: !isIndexableGeocoin(card),
    alternates: alternatesFor('geocoin', card.slug),
    jsonLd: [geocoinLd(card, { name, description: desc, rarityLabel: rar, url: abs(path), lang })].filter(Boolean),
  })
  await writePage(path, page({ lang, head, body }))
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

const CHANGEFREQ = { home: 'daily', 'release-notes': 'weekly', faq: 'monthly', support: 'monthly' }
const PRIORITY   = { home: '1.0', 'release-notes': '0.7', faq: '0.7', support: '0.5' }

function sitemap(entries) {
  const urls = entries.map(({ route, param }) => {
    const alts = alternatesFor(route, param)
    return SEO_LANGS.map(lang => `  <url>
    <loc>${abs(alts[lang])}</loc>
${SEO_LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(alts[l])}" />`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(alts[DEFAULT_LANG])}" />
    <changefreq>${CHANGEFREQ[route] ?? 'monthly'}</changefreq>
    <priority>${PRIORITY[route] ?? '0.6'}</priority>
  </url>`).join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

// ─── Exécution ────────────────────────────────────────────────────────────────

if (!API) warn('VITE_API_URL absente : pages publiées sans contenu éditorial.')

const config = await fetchPublicConfig()
const hidden = Array.isArray(config.docs_hidden_pages) ? config.docs_hidden_pages : []
// Sans ces traductions, une page anglaise afficherait « Hommages » en français.
const typeTranslations = config.type_translations ?? {}
if (hidden.length) console.log(`ℹ️  Onglets docs masqués, non publiés : ${hidden.join(', ')}`)

const published = [{ route: 'home' }]

for (const lang of SEO_LANGS) await buildHome(lang, hidden)
console.log(`✅ accueil — ${SEO_LANGS.length} langues`)

for (const route of DOCS_ROUTES) {
  if (hidden.includes(route)) continue
  let withContent = 0
  for (const lang of SEO_LANGS) {
    const content = await fetchDocs(route, lang)
    if (await buildDocs(route, lang, content)) withContent++
  }
  published.push({ route })
  console.log(`✅ /${route} — ${SEO_LANGS.length} langues, ${withContent} avec contenu`)
  if (!withContent) warn(`/${route} publiée sans contenu (métadonnées seules).`)
}

// Fiches geocoin : le pool public sert à la fois de source de pages et d'entrées
// de sitemap, pour qu'aucune URL indexée ne pointe sur une page absente.
const cardsJson = await apiGet('/api/cards')
const geocoins  = publicGeocoins(cardsJson?.data?.cards ?? cardsJson?.cards ?? [])

let indexableGeocoins = 0
for (const card of geocoins) {
  const related = relatedGeocoins(geocoins, card, 6)
  for (const lang of SEO_LANGS) await buildGeocoin(card, related, lang)
  if (isIndexableGeocoin(card)) {
    published.push({ route: 'geocoin', param: card.slug })
    indexableGeocoins++
  }
}
if (geocoins.length) {
  console.log(`✅ /geocoins — ${geocoins.length} fiches × ${SEO_LANGS.length} langues, dont ${indexableGeocoins} indexables`)
  if (indexableGeocoins < geocoins.length) {
    console.log(`ℹ️  ${geocoins.length - indexableGeocoins} fiches en noindex faute de description (≥ ${MIN_INDEXABLE_DESCRIPTION} caractères). Décrire un geocoin l'ajoute au sitemap au build suivant.`)
  }
} else warn('Aucune fiche geocoin publiée (pool vide ou API injoignable).')

await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap(published))
console.log(`✅ sitemap.xml — ${published.length * SEO_LANGS.length} URLs`)

console.log(warnings ? `\nTerminé avec ${warnings} avertissement(s).` : '\nTerminé.')
