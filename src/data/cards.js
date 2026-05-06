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

// Définitions des achievements (logique de déclenchement — pas de données de cartes)
export const ACHIEVEMENT_DEF = [
  { id: 'first_blood',     label: 'First blood',      icon: '🩸', cardId: 901, check: (s) => !!s.quizCardEarned },
  { id: 'first_legendary', label: 'Légendaire',       icon: '🐉', cardId: 909, check: (s) => !!s.quizCardEarned && s.quizCardEarned.rarity === 'légendaire' },
  { id: 'cards_5',         label: 'Collectionneur',   icon: '🃏', cardId: 902, check: (s) => Object.keys(s.collection).filter(k => s.collection[k] > 0).length >= 5 },
  { id: 'buy_1',           label: 'Premier achat',    icon: '🛍️', cardId: 903, check: (s) => s.totalBuys >= 1 },
  { id: 'buy_10',          label: 'Acheteur vétéran', icon: '💳', cardId: 904, check: (s) => s.totalBuys >= 10 },
  { id: 'buy_50',          label: 'Super acheteur',   icon: '🏅', cardId: 905, check: (s) => s.totalBuys >= 50 },
  { id: 'sell_1',          label: 'Première vente',   icon: '🏷️', cardId: 906, check: (s) => s.totalSells >= 1 },
  { id: 'sell_50',         label: 'Vendeur vétéran',  icon: '🏅', cardId: 907, check: (s) => s.totalSells >= 50 },
  { id: 'sell_100',        label: 'Super vendeur',    icon: '🏆', cardId: 908, check: (s) => s.totalSells >= 100 },
  { id: 'daily_20',        label: 'Endurant',         icon: '⚡', cardId: 910, check: (s) => s.dailyCards >= 20 },
  { id: 'streak_30',       label: 'Fidèle',           icon: '🔥', cardId: 911, check: (s) => s.streak >= 30 },
];
