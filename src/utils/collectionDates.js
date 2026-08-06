// ── Frise de collection : ancienneté d'un geocoin ───────────────────────────
// Le joueur qui gagne un geocoin ne le retrouvait plus, noyé dans sa collection.
// Le tri « Récents » range les geocoins par date d'entrée en collection
// (`first_obtained_at`, servie par /api/collection) et les regroupe en sections.
//
// Les bornes sont des MINUITS LOCAUX, pas des fenêtres de 24 h glissantes :
// « aujourd'hui » doit vouloir dire aujourd'hui, y compris à 00 h 10.
//
// Une carte sans date connue — acquise avant le suivi, ou par un chemin sans
// journal comme la forge — rejoint « plus de 30 jours » : c'est forcément un
// vieux geocoin, et une section « date inconnue » n'apprendrait rien au joueur.

/** Ordre d'affichage des sections. */
export const COLL_SECTION_ORDER = ['today', 'week', 'month', 'older']

const startOfLocalDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

/** Section d'une date ISO (null/absente/illisible → 'older'). */
export function collSectionOf(iso, now = Date.now()) {
  if (!iso) return 'older'
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return 'older'
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
// Délai d'envoi groupé des acquittements au serveur (multi-appareils). Assez
// long pour qu'un parcours de collection tienne dans un seul envoi, assez court
// pour que l'autre appareil soit à jour avant qu'on y arrive.
export const SEEN_FLUSH_DELAY_MS = 3000

/** Assez récent pour porter le badge « New » ? */
export function isFreshlyObtained(iso, now = Date.now()) {
  if (!iso) return false
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) && (now - ts) < NEW_BADGE_DAYS * 864e5
}

/**
 * Découpe des clés d'acquittement (`id` pour un geocoin normal, `id_shiny` pour
 * un brillant) en deux listes d'identifiants, telles que les attend
 * POST /api/collection/seen. Les clés illisibles sont ignorées : le
 * localStorage peut contenir n'importe quoi (autre version, bidouille).
 */
export function splitSeenKeys(keys) {
  const cardIds = [], shinyIds = []
  for (const key of keys) {
    const id = parseInt(key, 10)
    if (!Number.isInteger(id) || id <= 0) continue
    if (String(key).endsWith('_shiny')) shinyIds.push(id)
    else cardIds.push(id)
  }
  return { cardIds, shinyIds }
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
