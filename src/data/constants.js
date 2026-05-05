export const QUIZ_INTERVAL      = 60;   // seconds between each quiz
export const PAGE_SIZE          = 10;   // items per admin page
export const PSEUDO_CHANGE_DAYS = 30;   // days between pseudo changes
export const PSEUDO_NOTIF_DAYS  = 15;   // days to show "new pseudo" badge
export const PACK_PRICE_LABEL   = '2,99 €';

export const DEFAULT_RANKS = [
  { min: 0,   label: 'Novice',          color: '#78909c', icon: '🌱' },
  { min: 5,   label: 'Explorateur',     color: '#42a5f5', icon: '🧭' },
  { min: 20,  label: 'Aventurier',      color: '#66bb6a', icon: '⛺' },
  { min: 50,  label: 'Chasseur',        color: '#ffa726', icon: '🎯' },
  { min: 100, label: 'Expert',          color: '#ab47bc', icon: '🔮' },
  { min: 200, label: 'Maître Geocoins', color: '#f9ca24', icon: '👑' },
];

export const DEFAULT_RARITY_RATES = { commun: 50, rare: 30, épique: 15, légendaire: 5 };

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
};
