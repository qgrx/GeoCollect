import { isTributeCard } from './geocaching.js'

// Rarity Config
export const RARITY_CONFIG = {
  commun:     { color: '#78909c', bg: '#eceff1', stars: 1, label: 'Commun',     labelKey: 'rarity_commun',     order: 3, cc: '#74c7ec,#b0bec5' },
  rare:       { color: '#1565c0', bg: '#e3f2fd', stars: 2, label: 'Rare',       labelKey: 'rarity_rare',       order: 2, cc: '#1565c0,#42a5f5' },
  épique:     { color: '#6a1b9a', bg: '#f3e5f5', stars: 3, label: 'Épique',     labelKey: 'rarity_epique',     order: 1, cc: '#6a1b9a,#ce93d8' },
  légendaire: { color: '#e65100', bg: '#fff3e0', stars: 4, label: 'Légendaire', labelKey: 'rarity_legendaire', order: 0, cc: '#e65100,#ffd54f' },
};

export const RC = RARITY_CONFIG;
export const rarityLabel = (rarity, t) => {
  const rc = RARITY_CONFIG[rarity]
  if (!rc) return rarity
  return t ? (t(rc.labelKey) || rc.label) : rc.label
};
export const typeLabel = (type, typeTranslations, lang) => {
  if (!type) return ''
  if (lang && lang !== 'fr' && typeTranslations?.[type]?.[lang]) return typeTranslations[type][lang]
  return type
};
/**
 * Nom affiché d'un geocoin.
 *
 * Cas particulier des geocoins d'HOMMAGE : leur nom est celui d'une cache réelle
 * (« Die grünen Geister », « Kluis tot kookhuis »…). C'est un nom propre, et
 * c'est sous ce nom-là que la cache existe sur geocaching.com : le traduire à la
 * place du titre couperait le lien entre le geocoin et la cache qu'il honore.
 * La traduction n'est donc pas un remplacement mais un sous-titre, cf.
 * `cardNameTranslation`.
 */
export const cardName = (card, lang) => {
  if (!card) return ''
  if (isTributeCard(card)) return card.name || ''
  if (lang && lang !== 'fr' && card.name_translations?.[lang]) return card.name_translations[lang]
  return card.name || ''
}

/**
 * Traduction du nom à afficher SOUS le titre d'origine, ou '' s'il n'y a rien à
 * montrer — parce qu'aucune traduction n'existe dans cette langue, ou parce
 * qu'elle est identique au titre (« Mingo », « Sagrada familia » : un nom propre
 * ne se traduit pas, et le répéter en petit n'apprendrait rien).
 *
 * Le français en fait partie, contrairement au reste de l'application : ici la
 * langue SOURCE est celle de la cache, pas le français.
 */
export const cardNameTranslation = (card, lang) => {
  if (!card || !lang) return ''
  const tr = String(card.name_translations?.[lang] || '').trim()
  if (!tr) return ''
  const same = (a, b) => a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                      === b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return same(tr, String(card.name || '').trim()) ? '' : tr
}
// Jumeau de cardName pour la description. Accepte les deux formes portées par un
// objet carte : brute du pool/API (description / description_translations) et
// celle du modal (desc / desc_translations, cf. App.jsx onSelect).
export const cardDescription = (card, lang) => {
  if (!card) return ''
  const tr = card.description_translations || card.desc_translations
  if (lang && lang !== 'fr' && tr?.[lang]) return tr[lang]
  return card.desc ?? card.description ?? ''
};

/**
 * Description LONGUE, réservée à la fiche publique du geocoin (/geocoins/…).
 *
 * Distincte de `cardDescription`, qui doit tenir sur la carte dans le jeu : une
 * page publique sans texte propre n'est qu'un nom et une rareté, et ne s'indexe
 * pas. Le texte source est en français, comme pour `description`.
 *
 * `fallback` (défaut) retombe sur la description courte quand la longue n'a pas
 * encore été rédigée : à l'affichage, mieux vaut montrer quelque chose. Le passer
 * à `false` répond à « cette fiche a-t-elle une VRAIE description longue ? », ce
 * qui décide de son indexation — sans quoi une description courte un peu bavarde
 * suffirait à faire indexer une page vide de contenu propre.
 */
export const cardLongDescription = (card, lang, { fallback = true } = {}) => {
  if (!card) return ''
  const tr = card.description_long_translations
  if (lang && lang !== 'fr' && tr?.[lang]) return tr[lang]
  if (card.description_long) return card.description_long
  return fallback ? cardDescription(card, lang) : ''
};
export const cardCC = (r) => {
  const [c1, c2] = (RC[r]?.cc || '#888,#aaa').split(',');
  return { c1, c2 };
};

// Métadonnées d'affichage des achievements NON évolutifs (toast de déverrouillage) —
// la logique de déclenchement est gérée côté serveur (achievementService.js).
// Les achievements ÉVOLUTIFS (L'acheteur, Le vendeur, Fidèle, Le collectionneur)
// passent par la popup de montée de palier (achievement_upgrades), pas par ce toast.
export const ACHIEVEMENT_DEF = [
  { id: 'quiz_1000',       label: 'Légendaire',        icon: '🐉', cardId: 909 },
];
