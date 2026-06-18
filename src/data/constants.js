export const QUIZ_INTERVAL      = 60;   // seconds between each quiz

// Normalise les paliers de cadence en liste [{ players, seconds }] triée.
// Tolère l'ancien format objet { "1":300, ... } et toute valeur invalide.
export function normalizeIntervalTiers(v) {
  const DEFAULT = [{ players: 1, seconds: 300 }, { players: 2, seconds: 90 }, { players: 3, seconds: 60 }, { players: 4, seconds: 30 }];
  let arr = null;
  if (Array.isArray(v)) {
    arr = v.filter(t => t && t.players != null && t.seconds != null).map(t => ({ players: +t.players, seconds: +t.seconds }));
  } else if (v && typeof v === 'object') {
    arr = Object.entries(v).filter(([k]) => /^\d+$/.test(k)).map(([k, s]) => ({ players: +k, seconds: +s }));
  }
  arr = (arr || []).filter(t => t.players >= 1 && t.seconds >= 1);
  return arr.length ? arr.sort((a, b) => a.players - b.players) : DEFAULT;
}
export const PAGE_SIZE          = 10;   // items per admin page
export const PSEUDO_CHANGE_DAYS = 30;   // days between pseudo changes
export const PSEUDO_NOTIF_DAYS  = 15;   // days to show "new pseudo" badge
export const PACK_PRICE_LABEL   = '2,99 €';

export const DEFAULT_RANKS = [
  { min: 0,   label: 'Novice',          color: '#78909c', icon: '🌱', labels: { fr: 'Novice',          en: 'Novice',         de: 'Neuling',         es: 'Novato'          } },
  { min: 5,   label: 'Explorateur',     color: '#42a5f5', icon: '🧭', labels: { fr: 'Explorateur',     en: 'Explorer',       de: 'Entdecker',       es: 'Explorador'      } },
  { min: 20,  label: 'Aventurier',      color: '#66bb6a', icon: '⛺', labels: { fr: 'Aventurier',      en: 'Adventurer',     de: 'Abenteurer',      es: 'Aventurero'      } },
  { min: 50,  label: 'Chasseur',        color: '#ffa726', icon: '🎯', labels: { fr: 'Chasseur',        en: 'Hunter',         de: 'Jäger',           es: 'Cazador'         } },
  { min: 100, label: 'Expert',          color: '#ab47bc', icon: '🔮', labels: { fr: 'Expert',          en: 'Expert',         de: 'Experte',         es: 'Experto'         } },
  { min: 200, label: 'Maître Geocoins', color: '#f9ca24', icon: '👑', labels: { fr: 'Maître Geocoins', en: 'Geocoin Master', de: 'Geocoin-Meister', es: 'Maestro Geocoins' } },
];

export const DEFAULT_RARITY_RATES = { commun: 50, rare: 30, épique: 15, légendaire: 5 };

export const DEFAULT_SCORE_RULES = { commun: 1, rare: 3, épique: 7, légendaire: 20 };

export const INIT_LIMITS = {
  connected:     { dailyGold: 200, dailyCards: 20 },
  quizInterval:  60,
  quizRarityRates: DEFAULT_RARITY_RATES,
  playerRanks:   DEFAULT_RANKS,
  marketSalesOpen: true,
  maxActiveListings: 10,
  botsVisible: false,
  supportVisible: true,
  leaderboardVisible: true,
  typeTranslations: {},
  shinyRate: 0.1,
  shinyForgeOpen: true,
  scoreRules: DEFAULT_SCORE_RULES,
  shinyMultiplier: 2,
  shinyForgeCostByRarity: { commun: null, rare: null, épique: null, légendaire: null },
  releaseNotesPublishedAt: null,
  quizJoinGoldCap: 50,
  quizJoinGold:      1,
  quizWinGold:       5,
  quizDailyCardCap:    20,
  quizHourlyCardCap:   0,
  quizConsolationGold:  5,
  quizConsolationForge: 1,
  quizDailyForgeCap:    0,
  quizIntervalTiers:    [{ players: 1, seconds: 300 }, { players: 2, seconds: 90 }, { players: 3, seconds: 60 }, { players: 4, seconds: 30 }],
  quizStreakHandicap:   { enabled: true, threshold: 3, step_seconds: 1.5, max_seconds: 8, min_players: 2 },
  forgeCostByRarity:    { commun: 60, rare: 180, épique: 600, légendaire: 1800 },
  meltPointsByRarity:   {},
  meltPointsByRarityShiny: {},
  marketPriceCaps:      { commun: {floor:5,k:2}, rare: {floor:25,k:2.5}, épique: {floor:150,k:3}, légendaire: {floor:1000,k:4} },
  marketListingFee:     1,
  marketSaleTax:        0.05,
  dailyOfferGold:       5,
  referralRequiredCount: 1,
  referralMinGeocoins:   50,
  referralMaxJoinGeocoins: 10,
  featureTresor:        true,
  featureMarket:        true,
  featureForge:         true,
  featureLeaderboard:   true,
};
