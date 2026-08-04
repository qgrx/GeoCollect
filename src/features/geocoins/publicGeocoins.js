/**
 * Sélection et tri des geocoins exposés publiquement.
 *
 * Module PUR, partagé par la page React et par scripts/prerender.mjs : les URLs
 * publiées dans le sitemap et celles que le composant sait afficher doivent être
 * exactement le même ensemble, sinon on indexe des pages qui répondent « 404 ».
 */
import { geocoinSlug } from '../../routes.js'
import { cardLongDescription } from '../../data/cards.js'
import { DEFAULT_LANG } from '../../seo/site.js'
import { richTextLength } from '../../utils/richText.js'

/**
 * Seuls les geocoins d'hommage sont publiés.
 *
 * Ce sont les seuls à raconter quelque chose : ils rendent hommage à une cache,
 * un lieu ou une figure du geocaching, donc portent un contenu qui a du sens hors
 * du jeu. Les geocoins de pays ou de chasseur de trésor n'ont, eux, rien à dire
 * qu'un nom et une rareté — et les achievements décrivent un accomplissement de
 * joueur, pas un objet de collection.
 *
 * Liste blanche volontairement, et non liste noire : un nouveau type de geocoin
 * ne doit pas se retrouver publié par inadvertance.
 * Attention à la casse exacte des types, tels qu'ils sont stockés en base.
 */
export const PUBLISHED_TYPES = ['Hommages']

/**
 * `GET /api/cards` filtre déjà `active` et `hidden` côté serveur ; le garde-fou
 * `hidden` reste là au cas où l'appelant fournirait le pool admin, qui contient
 * des brouillons jamais publiés.
 */
export function isPublicGeocoin(card) {
  if (!card || card.hidden) return false
  if (!Number.isFinite(Number(card.id))) return false
  if (!card.name) return false
  return PUBLISHED_TYPES.includes(card.type)
}

/**
 * Pool public, chaque entrée enrichie de son `slug` d'URL.
 *
 * Le slug est bâti sur le nom SOURCE (`card.name`), jamais sur une traduction, et
 * reste identique dans toutes les langues : une même fiche garde ainsi une seule
 * identité d'URL, distinguée par le seul préfixe de langue. Le faire dépendre
 * d'une traduction ferait changer l'URL — donc perdre le référencement acquis —
 * à la moindre retouche de celle-ci.
 */
export function publicGeocoins(pool) {
  return (Array.isArray(pool) ? pool : [])
    .filter(isPublicGeocoin)
    .map(card => ({ ...card, slug: geocoinSlug(card.id, card.name) }))
    .sort((a, b) => a.id - b.id)
}

/**
 * Longueur de description LONGUE à partir de laquelle une fiche est indexée.
 *
 * C'est `description_long` qui est évaluée, pas la description courte affichée
 * sur la carte : cette dernière tient en une ligne et ne fait pas une page. Sans
 * ce seuil, on soumettrait à Google des pages réduites à un nom et une rareté —
 * du « contenu mince » qu'il n'indexe pas et qui dilue la qualité perçue du
 * domaine. Les fiches en dessous restent servies et partageables, mais portent
 * `noindex, follow` et sortent du sitemap : rédiger la description longue suffit
 * à les y faire entrer au build suivant.
 *
 * La langue n'entre pas en jeu : `cardLongDescription` retombe sur la langue par
 * défaut quand une traduction manque, donc une fiche décrite l'est partout.
 *
 * Le seuil porte sur le TEXTE, balisage exclu : la description est saisie dans
 * un éditeur riche, et compter son HTML laisserait entrer au sitemap une fiche
 * dont les `<p>`, `<strong>` et attributs de lien font tout le volume.
 */
export const MIN_INDEXABLE_DESCRIPTION = 160

export function isIndexableGeocoin(card) {
  // `fallback: false` — la description courte de la carte ne doit jamais suffire
  // à faire indexer une fiche qui n'a pas de contenu propre.
  return richTextLength(cardLongDescription(card, DEFAULT_LANG, { fallback: false })) >= MIN_INDEXABLE_DESCRIPTION
}

/**
 * Suggestions de maillage interne : d'abord le même type, puis la même rareté,
 * en poussant devant les fiches indexables — c'est vers elles qu'il faut diriger
 * les robots.
 * Sans ces liens, chaque fiche serait une impasse atteignable par le seul sitemap.
 */
export function relatedGeocoins(pool, card, max = 6) {
  if (!card) return []
  const others = publicGeocoins(pool).filter(c => c.id !== card.id)
  const sameType   = others.filter(c => card.type && c.type === card.type)
  const sameRarity = others.filter(c => c.rarity === card.rarity && !sameType.includes(c))
  const ranked = [...sameType, ...sameRarity]
  return [
    ...ranked.filter(isIndexableGeocoin),
    ...ranked.filter(c => !isIndexableGeocoin(c)),
  ].slice(0, max)
}
