import DOMPurify from 'dompurify'

/**
 * Sanitise du HTML potentiellement fourni par un admin avant rendu.
 * Autorise les balises de mise en forme courantes, interdit les scripts.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br',
                   'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'span', 'font'],
    ALLOWED_ATTR: ['style', 'color', 'size'],
  })
}
