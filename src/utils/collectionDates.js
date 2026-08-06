// ── Frise de collection : ancienneté d'un geocoin ───────────────────────────
// Le joueur qui gagne un geocoin ne le retrouvait plus, noyé dans sa collection.
// Le tri « Récents » range les geocoins par date d'entrée en collection
// (`first_obtained_at`, servie par /api/collection) et les regroupe en sections.
//
// Les bornes sont des MINUITS LOCAUX, pas des fenêtres de 24 h glissantes :
// « aujourd'hui » doit vouloir dire aujourd'hui, y compris à 00 h 10. Une carte
// sans date connue — acquise avant le suivi, ou par un chemin sans journal comme
// la forge — tombe dans une section « date inconnue » finale.

/** Ordre d'affichage des sections. */
export const COLL_SECTION_ORDER = ['today', 'week', 'month', 'older', 'unknown']

const startOfLocalDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

/** Section d'une date ISO (null/absente/illisible → 'unknown'). */
export function collSectionOf(iso, now = Date.now()) {
  if (!iso) return 'unknown'
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return 'unknown'
  // Une date future (horloge du client en retard sur le serveur) reste « aujourd'hui ».
  const days = Math.floor((startOfLocalDay(now) - startOfLocalDay(ts)) / 864e5)
  if (days <= 0) return 'today'
  if (days < 7)  return 'week'
  if (days < 30) return 'month'
  return 'older'
}

// Badge « New » : geocoin obtenu depuis moins de 7 jours et que le joueur n'a
// encore ni survolé ni ouvert dans sa collection (acquittement en localStorage).
export const NEW_BADGE_DAYS = 7
export const SEEN_CARDS_KEY = 'geocoins_seen_cards'

/** Assez récent pour porter le badge « New » ? */
export function isFreshlyObtained(iso, now = Date.now()) {
  if (!iso) return false
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) && (now - ts) < NEW_BADGE_DAYS * 864e5
}

/**
 * Regroupe une liste DÉJÀ triée (plus récent d'abord) en insérant un en-tête
 * `{ __header: section }` avant chaque groupe. Les en-têtes vivent dans la même
 * liste plate que les geocoins : le défilement par lots de CollectionScroll
 * continue de fonctionner tel quel, un en-tête étant un élément pleine largeur.
 */
export function withSectionHeaders(items, now = Date.now()) {
  const buckets = new Map(COLL_SECTION_ORDER.map(k => [k, []]))
  for (const item of items) buckets.get(collSectionOf(item.at, now)).push(item)
  const out = []
  for (const key of COLL_SECTION_ORDER) {
    const group = buckets.get(key)
    if (!group.length) continue
    out.push({ __header: key })
    out.push(...group)
  }
  return out
}
