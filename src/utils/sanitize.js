import DOMPurify from 'dompurify'

function isDarkColor(c) {
  c = c.toLowerCase().trim()
  if (c === 'black') return true
  let r, g, b, m
  if ((m = c.match(/^#([0-9a-f]{3})$/)))      { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16) }
  else if ((m = c.match(/^#([0-9a-f]{6})$/))) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16) }
  else if ((m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/))) { r = +m[1]; g = +m[2]; b = +m[3] }
  else return false
  return Math.max(r, g, b) <= 64
}

/**
 * Neutralise les couleurs de texte noires/très sombres. En dark mode elles rendent
 * le texte illisible ; en les retirant, le texte hérite de la couleur du thème
 * (sombre en mode clair, claire en mode sombre). Corrige le contenu existant
 * (souvent rempli de `color: rgb(0,0,0)`) comme tout futur contenu, automatiquement.
 */
export function neutralizeDarkText(html) {
  if (!html) return html
  return html.replace(/color\s*:\s*([^;"']+)/gi, (full, color) => (isDarkColor(color) ? '' : full))
}

/**
 * Sanitise du HTML potentiellement fourni par un admin avant rendu.
 * Autorise les balises de mise en forme courantes, interdit les scripts.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br', 'a',
                   'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'span', 'font', 'img'],
    ALLOWED_ATTR: ['style', 'color', 'size', 'src', 'alt', 'width', 'height', 'href', 'target', 'rel'],
    // Autorise les images intégrées en data URI (base64) en plus des URLs http(s).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpeg|gif|webp);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
}
