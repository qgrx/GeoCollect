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
export const cardName = (card, lang) => {
  if (!card) return ''
  if (lang && lang !== 'fr' && card.name_translations?.[lang]) return card.name_translations[lang]
  return card.name || ''
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
