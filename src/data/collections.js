/**
 * Collections de geocoins — des vagues de publication, pas des saisons.
 *
 * Une COLLECTION regroupe tout ce qui est sorti dans une même période. Elle se
 * déduit donc de la date de publication (`cards.published_at`), sans colonne ni
 * saisie : un geocoin ne peut pas se tromper de collection, et rebaptiser une
 * collection ne demande pas de toucher aux cartes.
 *
 * À ne pas confondre avec `cards.season_id` (saisons du JEU : printemps, été…),
 * qui pilote la disponibilité d'un geocoin et non son millésime.
 *
 * ⚠️ `from` et `to` sont des dates ISO en UTC, bornes incluse/exclue. Pour ouvrir
 * une nouvelle collection, fermer la précédente à la même date que l'ouverture
 * de la suivante : les intervalles doivent se toucher sans se recouvrir, faute
 * de quoi un geocoin publié dans le trou n'aurait aucune collection.
 */
export const COLLECTIONS = [
  {
    code: 'vanilla',
    // Tout ce qui existait avant août 2026 : les geocoins d'origine, ceux avec
    // lesquels le jeu a ouvert. Pas de borne basse — une carte plus ancienne que
    // prévu reste dans la première collection, jamais hors collection.
    from: null,
    to: '2026-08-01T00:00:00Z',
    label: { fr: 'Vanilla', en: 'Vanilla', de: 'Vanilla', es: 'Vanilla' },
  },
]

/**
 * Collection d'un geocoin d'après sa date de publication, ou `null`.
 *
 * `null` quand la date manque (brouillon jamais publié, carte antérieure à la
 * colonne) ou qu'aucune collection ne couvre cette période : la fiche omet
 * alors la ligne plutôt que d'inventer une appartenance.
 */
export function collectionForDate(publishedAt) {
  if (!publishedAt) return null
  const t = Date.parse(publishedAt)
  if (Number.isNaN(t)) return null
  return COLLECTIONS.find(c =>
    (!c.from || t >= Date.parse(c.from)) && (!c.to || t < Date.parse(c.to)),
  ) ?? null
}

/** Libellé traduit d'une collection, avec repli sur le français puis le code. */
export function collectionLabel(collection, lang = 'fr') {
  if (!collection) return ''
  return collection.label[lang] || collection.label.fr || collection.code
}

/** Raccourci : libellé de la collection d'une carte, '' si indéterminée. */
export function cardCollectionLabel(card, lang = 'fr') {
  return collectionLabel(collectionForDate(card?.published_at), lang)
}
