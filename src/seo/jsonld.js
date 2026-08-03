/**
 * Constructeurs de données structurées schema.org (JSON-LD).
 *
 * Toutes ces fonctions sont PURES et sans dépendance : elles sont consommées à la
 * fois par vite.config.js (injection dans index.html au build) et, à terme, par le
 * script de pré-rendu. Aucune ne touche au DOM.
 *
 * Le bloc `Organization` est ce qui permet à Google d'associer explicitement le
 * logo à la marque — c'est le signal le plus direct pour qu'il l'affiche.
 */
import { SITE_URL, SITE_NAME, SEO_LANGS, DEFAULT_LANG, abs } from './site.js'

/** Retire tout balisage et normalise les espaces : schema.org attend du texte nu. */
export function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: abs('/icon-512.png'),
      width: 512,
      height: 512,
    },
  }
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: SEO_LANGS,
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

export function videoGameLd({ description, lang = DEFAULT_LANG } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    '@id': `${SITE_URL}/#game`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description,
    inLanguage: lang,
    image: abs('/og-image.png'),
    applicationCategory: 'GameApplication',
    gamePlatform: 'Web browser',
    genre: ['Collecting', 'Trivia'],
    isAccessibleForFree: true,
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

/** @param entries liste `{ q, a }` telle que servie par GET /api/docs/faq */
export function faqPageLd(entries, { url } = {}) {
  const mainEntity = (entries ?? [])
    .map(e => ({ q: stripHtml(e?.q), a: stripHtml(e?.a) }))
    .filter(e => e.q && e.a)
    .map(e => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: { '@type': 'Answer', text: e.a },
    }))
  if (!mainEntity.length) return null   // un FAQPage vide est une erreur de validation
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(url ? { url } : {}),
    mainEntity,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }
}

/**
 * Fiche publique d'un geocoin.
 * @param card  carte telle que servie par GET /api/cards
 * @param opts  `name`/`description` déjà localisés (cf. cardName/cardDescription),
 *              `rarityLabel` localisé, et `url` absolue de la page.
 */
export function geocoinLd(card, { name, description, rarityLabel, url, lang = DEFAULT_LANG } = {}) {
  if (!card) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: name || card.name,
    ...(description ? { description: stripHtml(description) } : {}),
    ...(card.image_url ? { image: card.image_url } : {}),
    ...(url ? { url } : {}),
    inLanguage: lang,
    genre: card.type || undefined,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(rarityLabel
      ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'rarity', value: rarityLabel }] }
      : {}),
  }
}

/**
 * Sérialise des blocs en balise `<script>` prête à être injectée.
 * `<` est échappé : un contenu éditorial contenant `</script>` refermerait
 * autrement la balise et injecterait du HTML arbitraire dans la page.
 */
export function ldScript(...blocks) {
  const kept = blocks.filter(Boolean)
  if (!kept.length) return ''
  const json = JSON.stringify(kept.length === 1 ? kept[0] : kept).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}
