/**
 * Contenu éditorial riche (HTML de l'éditeur) : conversion et mesure.
 *
 * Module PUR et sans DOM : il est lu par la page React comme par
 * `scripts/prerender.mjs`, qui tourne dans Node au build.
 *
 * Il existe pour une seule raison — l'HÉRITAGE. Les descriptions longues des
 * geocoins ont d'abord été saisies dans un `<textarea>` : ce sont des textes
 * bruts dont les sauts de ligne portent toute la structure. Depuis le passage à
 * l'éditeur riche, les nouvelles sont du HTML. Les deux formes cohabitent dans
 * la même colonne et doivent s'afficher pareil, sans migration de données :
 *  - rendre un texte brut tel quel écraserait tous ses sauts de ligne en un pavé ;
 *  - échapper du HTML afficherait `<p>Bonjour</p>` en toutes lettres.
 *
 * La sanitisation reste à la charge de l'appelant (`sanitizeHtml`) : ce module
 * ne décide pas de ce qui est sûr, il décide de ce qui est du HTML.
 */
import { stripHtml } from '../seo/jsonld.js'

const TAG = /<(\/?)(p|br|div|h[1-6]|ul|ol|li|strong|b|em|i|u|s|a|img|span|table|thead|tbody|tr|td|th|blockquote|pre|code)\b[^>]*>/i

/**
 * Le contenu vient-il de l'éditeur riche ?
 *
 * Volontairement basé sur une liste de balises CONNUES plutôt que sur un `<`
 * quelconque : « la cache est à 3 < 5 km du parking » est du texte brut, et le
 * traiter comme du HTML lui ferait perdre ses paragraphes.
 */
export function isHtmlContent(value) {
  return !!value && TAG.test(String(value))
}

function escapeText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Contenu prêt à être rendu (après sanitisation) : le HTML tel quel, ou le texte
 * brut converti en paragraphes — ligne vide = nouveau paragraphe, saut simple =
 * `<br />`, exactement ce que l'auteur voyait dans son textarea.
 */
export function richTextHtml(value) {
  if (!value) return ''
  if (isHtmlContent(value)) return String(value)
  return String(value)
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeText(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

/** Texte nu du contenu — pour compter, résumer ou comparer. */
export function richTextPlain(value) {
  return stripHtml(value)
}

/**
 * Longueur du TEXTE, balisage exclu.
 *
 * C'est la seule mesure qui a un sens pour décider qu'une page a du contenu :
 * compter le HTML brut ferait passer le seuil d'indexation à coups de balises,
 * et une fiche vide entrerait au sitemap sur la foi de son `<p>`.
 */
export function richTextLength(value) {
  return richTextPlain(value).length
}
