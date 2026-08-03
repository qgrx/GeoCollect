/**
 * Sérialise le contenu éditorial des pages docs en HTML sémantique statique.
 *
 * Ce HTML est déposé dans `<div id="root">` par scripts/prerender.mjs : c'est ce
 * que lisent les moteurs et les visiteurs sans JS. React le remplace par la
 * version live au premier rendu, donc les deux disent la même chose — on ne sert
 * pas un contenu différent aux robots.
 *
 * Fonctions PURES : la sanitisation est injectée (`sanitize`) plutôt qu'importée,
 * pour que le module reste testable sans DOM et que le script de build puisse y
 * brancher exactement l'allowlist de src/utils/sanitize.js.
 */

/** Échappement du texte brut (titres, questions, numéros de version). */
export function escapeText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const identity = (h) => h ?? ''

/** Premiers mots utiles du contenu, pour une meta description à défaut de copie dédiée. */
export function excerpt(text, max = 155) {
  const clean = String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

function releaseNotes(content, sanitize) {
  return content
    .filter(rel => rel?.version || rel?.items?.length)
    .map(rel => {
      const items = (rel.items ?? [])
        .map(it => sanitize(it?.text))
        .filter(Boolean)
        .map(html => `<li>${html}</li>`)
        .join('')
      return `<article><h2>${escapeText(rel.version)}</h2>${items ? `<ul>${items}</ul>` : ''}</article>`
    })
    .join('\n')
}

function faq(content, sanitize) {
  return content
    .filter(e => e?.q)
    .map(e => `<section><h2>${escapeText(e.q)}</h2><div>${sanitize(e.a)}</div></section>`)
    .join('\n')
}

function support(content, sanitize) {
  return content
    .filter(s => s?.title || s?.desc)
    .map(s => {
      const title = `${s.icon ? `${escapeText(s.icon)} ` : ''}${escapeText(s.title)}`
      return `<section><h2>${title}</h2><div>${sanitize(s.desc)}</div></section>`
    })
    .join('\n')
}

const RENDERERS = { 'release-notes': releaseNotes, faq, support }

/**
 * @param page      'release-notes' | 'faq' | 'support'
 * @param content   tableau tel que servi par GET /api/docs/:page
 * @param heading   titre de niveau 1, déjà traduit
 * @param sanitize  nettoyage du HTML éditorial (identité par défaut, tests)
 * @returns `{ html, text }` — `text` sert à dériver une meta description.
 */
export function renderDocsPage({ page, content, heading, sanitize = identity }) {
  const render = RENDERERS[page]
  const list   = Array.isArray(content) ? content : []
  if (!render || !list.length) return { html: '', text: '' }

  const body = render(list, sanitize)
  if (!body) return { html: '', text: '' }

  const html = `<main class="prerendered"><h1>${escapeText(heading)}</h1>\n${body}\n</main>`
  return { html, text: excerpt(body) }
}

/**
 * Feuille de style minimale du contenu pré-rendu. Il n'est visible qu'avant
 * l'hydratation ; l'objectif est seulement d'éviter un flash de page blanche non
 * stylée sur une connexion lente.
 */
export const PRERENDER_STYLE = `<style>
  body { margin: 0; background: #0f0f1e; }
  .prerendered { max-width: 680px; margin: 0 auto; padding: 32px 24px 64px;
    font-family: 'Nunito', system-ui, sans-serif; color: #d4e8f8; line-height: 1.55; }
  .prerendered h1 { font-family: 'Fredoka One', 'Nunito', sans-serif; font-size: 28px; color: #f9ca24; margin: 0 0 24px; }
  .prerendered h2 { font-size: 16px; margin: 24px 0 8px; }
  .prerendered a { color: #a29bfe; }
  .prerendered img { max-width: 100%; height: auto; }
</style>`
