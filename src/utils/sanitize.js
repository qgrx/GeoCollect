import DOMPurify from 'dompurify'

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
