/**
 * Valeurs de jeu réglables en admin, exposées au contenu éditorial.
 *
 * La page « Règles du jeu » est rédigée en base (docs_pages) mais elle cite des
 * chiffres — plafonds, prix, cadences — qui vivent, eux, dans la table `config`
 * et changent au gré des rééquilibrages. Les recopier dans le texte condamnait
 * la page à mentir dès le premier ajustement.
 *
 * Le rédacteur écrit donc des marqueurs `{{nom}}` que ce module remplace par la
 * valeur du moment. Les noms sont ceux d'un joueur, pas ceux de la base :
 * `{{geocoins_par_jour}}` et non `{{quiz_daily_card_cap}}` — le contenu ne doit
 * pas dépendre du nommage interne.
 *
 * Les valeurs sont LOCALISÉES : séparateur de milliers, unités de durée et
 * énumérations par rareté suivent la langue de la page. Sans quoi une page
 * anglaise afficherait « 60 pour un commun, 180 pour un rare… » au milieu d'une
 * phrase en anglais. Les marqueurs, eux, restent identiques dans toutes les
 * langues : une seule rédaction, quatre rendus.
 *
 * Module PUR : aucune dépendance React. Il est importé par l'application ET par
 * scripts/prerender.mjs, pour que la page statique et la page vivante affichent
 * exactement les mêmes chiffres.
 *
 * Toute valeur absente de la config publique retombe sur le défaut appliqué par
 * l'API (cf. geocards-api/src/routes/config.js). Un marqueur inconnu est laissé
 * tel quel : mieux vaut un `{{typo}}` visible en page qu'un trou silencieux.
 */

// ─── Localisation ─────────────────────────────────────────────────────────────

const LOCALES = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES' }

/**
 * Fragments de phrase par langue. `rarity` porte l'article et l'accord attendus
 * après un nombre — « 60 for a common », « 60 für einen gewöhnlichen ».
 */
const WORDS = {
  fr: {
    then: 'puis',
    minute: n => `${n} minute${n > 1 ? 's' : ''}`,
    second: n => `${n} seconde${n > 1 ? 's' : ''}`,
    rarity: { commun: 'pour un commun', rare: 'pour un rare', 'épique': 'pour un épique', 'légendaire': 'pour un légendaire' },
  },
  en: {
    then: 'then',
    minute: n => `${n} minute${n > 1 ? 's' : ''}`,
    second: n => `${n} second${n > 1 ? 's' : ''}`,
    rarity: { commun: 'for a common', rare: 'for a rare', 'épique': 'for an epic', 'légendaire': 'for a legendary' },
  },
  de: {
    then: 'dann',
    minute: n => `${n} Minute${n > 1 ? 'n' : ''}`,
    second: n => `${n} Sekunde${n > 1 ? 'n' : ''}`,
    rarity: { commun: 'für einen gewöhnlichen', rare: 'für einen seltenen', 'épique': 'für einen epischen', 'légendaire': 'für einen legendären' },
  },
  es: {
    then: 'luego',
    minute: n => `${n} minuto${n > 1 ? 's' : ''}`,
    second: n => `${n} segundo${n > 1 ? 's' : ''}`,
    rarity: { commun: 'para un común', rare: 'para un raro', 'épique': 'para un épico', 'légendaire': 'para un legendario' },
  },
}

const wordsFor = (lang) => WORDS[lang] ?? WORDS.fr

// ─── Formatage ────────────────────────────────────────────────────────────────

function formatters(lang) {
  const nf = new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.fr)
  const w  = wordsFor(lang)

  /** Nombre localisé : 1800 → « 1 800 » / « 1,800 » / « 1.800 ». */
  const num = (v, fallback = 0) => nf.format(Number.isFinite(Number(v)) ? Number(v) : fallback)

  /** Taux 0,1 → « 10 % ». Deux décimales au plus, sans zéros inutiles. */
  const pct = (v, fallback = 0) => {
    const n = Number.isFinite(Number(v)) ? Number(v) : fallback
    return `${nf.format(Math.round(n * 10000) / 100)} %`
  }

  /** Pourcentage déjà exprimé en base 100 (quiz_rarity_rates) : 69.9 → « 69,9 % ». */
  const pct100 = (v, fallback = 0) => {
    const n = Number.isFinite(Number(v)) ? Number(v) : fallback
    return `${nf.format(Math.round(n * 100) / 100)} %`
  }

  /** Durée en secondes → « 1 minute » / « 20 seconds ». */
  const dur = (v, fallback = 0) => {
    const s = Number.isFinite(Number(v)) ? Number(v) : fallback
    return (s >= 60 && s % 60 === 0) ? w.minute(nf.format(s / 60)) : w.second(nf.format(s))
  }

  /** Liste de prix croissants → « 500, puis 1 000, puis 2 000 ». */
  const priceList = (arr, fallback = []) => {
    const list = Array.isArray(arr) && arr.length ? arr : fallback
    const parts = list.map(v => num(v))
    if (parts.length <= 1) return parts[0] ?? '—'
    return `${parts[0]}, ${w.then} ${parts.slice(1).join(`, ${w.then} `)}`
  }

  /** Barème par rareté → « 60 pour un commun, 180 pour un rare, … ». */
  const byRarity = (obj, fallback = {}) => {
    const o = obj && typeof obj === 'object' ? obj : fallback
    const rows = ['commun', 'rare', 'épique', 'légendaire']
      .filter(k => o[k] !== undefined && o[k] !== null)
    if (!rows.length) return '—'
    return rows.map(k => `${num(o[k])} ${w.rarity[k]}`).join(', ')
  }

  return { num, pct, pct100, dur, priceList, byRarity }
}

// ─── Table des marqueurs ──────────────────────────────────────────────────────

/**
 * Construit la table `{ marqueur: texte }` à partir de la config publique.
 *
 * @param {object} config  objet servi par GET /api/config
 * @param {string} lang    langue de la page ('fr' | 'en' | 'de' | 'es')
 * @returns {Record<string,string>}
 */
export function gameValues(config = {}, lang = 'fr') {
  const c = config && typeof config === 'object' ? config : {}
  const { num, pct, pct100, dur, priceList, byRarity } = formatters(lang)

  const limits   = c.limits_connected      && typeof c.limits_connected      === 'object' ? c.limits_connected : {}
  const rates    = c.quiz_rarity_rates     && typeof c.quiz_rarity_rates     === 'object' ? c.quiz_rarity_rates : {}
  const handicap = c.quiz_streak_handicap  && typeof c.quiz_streak_handicap  === 'object' ? c.quiz_streak_handicap : {}

  // Paliers de geocoins multiples : on ne cite que le seuil le plus parlant pour
  // un joueur — « à partir de N joueurs ».
  const prizeTiers = Array.isArray(c.quiz_prize_tiers) ? [...c.quiz_prize_tiers].sort((a, b) => a.players - b.players) : []
  const firstMulti = prizeTiers[0]

  return {
    // ── Le quiz ──────────────────────────────────────────────────────────────
    duree_manche_entrainement: dur(c.beginner_quiz_duration, 60),
    fenetre_geocoins_suivants: dur(c.quiz_extra_prize_grace, 20),
    joueurs_pour_plusieurs_geocoins: num(firstMulti?.players, 10),
    geocoins_multiples_a_ce_palier: num(firstMulti?.prizes, 2),

    // ── Chances de tirage ────────────────────────────────────────────────────
    chance_commun: pct100(rates.commun, 69.9),
    chance_rare: pct100(rates.rare, 25),
    chance_epique: pct100(rates['épique'], 5),
    chance_legendaire: pct100(rates['légendaire'], 0.1),
    chance_brillant: pct(c.shiny_rate, 0.1),

    // ── Vos limites ──────────────────────────────────────────────────────────
    geocoins_par_jour: num(c.quiz_daily_card_cap, 25),
    geocoins_par_heure: num(c.quiz_hourly_card_cap, 12),
    brillants_par_jour: num(c.quiz_daily_shiny_cap, 3),
    or_par_jour: num(limits.dailyGold, 250),
    forge_par_jour: num(c.quiz_daily_forge_cap, 120),
    plafond_rare_par_semaine: num(c.quiz_weekly_cap_rare, 80),
    plafond_epique_par_semaine: num(c.quiz_weekly_cap_epique, 20),
    plafond_legendaire_par_semaine: num(c.quiz_weekly_cap_legendaire, 1),

    // ── Récompenses ──────────────────────────────────────────────────────────
    or_par_victoire: num(c.quiz_win_gold, 5),
    or_du_tresor: num(c.daily_offer_gold, 5),
    forge_de_consolation: num(c.quiz_consolation_forge, 1),

    // ── La forge ─────────────────────────────────────────────────────────────
    prix_forge: byRarity(c.forge_cost_by_rarity, { commun: 60, rare: 180, 'épique': 600, 'légendaire': 1800 }),
    prix_brillance: byRarity(c.shiny_forge_cost_by_rarity, { commun: 60, rare: 180, 'épique': 600, 'légendaire': 1800 }),
    gain_fonte: byRarity(c.melt_points_by_rarity, { commun: 1, rare: 3, 'épique': 10, 'légendaire': 100 }),
    gain_fonte_brillant: byRarity(c.melt_points_by_rarity_shiny, { commun: 2, rare: 6, 'épique': 20, 'légendaire': 200 }),

    // ── Le marché ────────────────────────────────────────────────────────────
    frais_mise_en_vente: num(c.market_listing_fee, 4),
    taxe_de_vente: pct(c.market_sale_tax, 0.12),
    annonces_maximum: num(c.max_active_listings, 40),

    // ── Sac, poches et dépôt ─────────────────────────────────────────────────
    prix_emplacements_sac: priceList(c.bag_slot_prices, [500, 1000, 1000, 1000, 1000]),
    prix_emplacements_sac_brillant: priceList(c.shiny_bag_slot_prices, [200, 500, 1000]),
    prix_boost_poches: num(c.pocket_boost_price, 50),
    geocoins_boost_poches: num(c.pocket_boost_cards, 5),
    prix_emplacements_depot: priceList(c.hold_slot_prices, [1000, 5000]),
    prix_location_depot: num(c.hold_rent_price, 200),

    // ── Séries ───────────────────────────────────────────────────────────────
    serie_pour_etre_en_feu: num(handicap.threshold, 3),

    // ── Parrainage ───────────────────────────────────────────────────────────
    geocoins_pour_valider_un_filleul: num(c.referral_min_geocoins, 80),
  }
}

/** Marqueurs disponibles, pour l'aide affichée à l'admin qui rédige. */
export const VALUE_KEYS = Object.keys(gameValues({}))

const MARKER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

/**
 * Remplace les marqueurs d'un texte ou d'un fragment HTML.
 *
 * À appeler AVANT la sanitisation : les valeurs injectées sont produites ici
 * (nombres et libellés courts) et échappées, elles traversent l'allowlist sans
 * dommage — et un marqueur ne peut jamais introduire de balise.
 *
 * @param {string} input
 * @param {Record<string,string>} values  sortie de gameValues()
 */
export function resolveGameValues(input, values = {}) {
  if (!input) return input
  return String(input).replace(MARKER, (whole, key) => {
    const v = values[key.toLowerCase()]
    // Marqueur inconnu laissé visible : une coquille doit se voir, pas se taire.
    return v === undefined ? whole : escapeValue(v)
  })
}

/** Les valeurs sont du texte : elles ne doivent pas pouvoir ouvrir de balise. */
function escapeValue(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
