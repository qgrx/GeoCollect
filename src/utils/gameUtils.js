import { RARITY_CONFIG } from '../data/cards.js';

export const normA = (s) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

export const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Nombre de geocoins uniques possédés = entrées de collection avec quantité > 0.
// Règle unique (cohérente profil / classement) : achievements inclus, brillants
// comptés séparément (via une autre collection). NE compte PAS les quantités.
export const countOwnedUnique = (col = {}) =>
  Object.values(col).filter(n => (n || 0) > 0).length;

// Handicap (s) du joueur en série — miroir du backend (utils/streakHandicap.js).
// handicap = min(max, (série − seuil + 1) × pas), nul sous le seuil / si désactivé.
export function computeStreakHandicap(streak, cfg = {}) {
  const enabled  = cfg.enabled !== false;
  const threshold = Math.max(1, Number(cfg.threshold) || 3);
  const step      = Math.max(0, Number(cfg.step_seconds) || 1.5);
  const max       = Math.max(0, Number(cfg.max_seconds) || 8);
  if (!enabled || streak < threshold) return 0;
  return Math.min(max, (streak - threshold + 1) * step);
}

// Cartes exemptées de handicap (course équitable) : légendaire ou épique brillante.
export function isHandicapExemptCard(rarity, isShiny) {
  return rarity === 'légendaire' || (rarity === 'épique' && !!isShiny);
}

// Date du jour (YYYY-MM-DD) à Paris — même fuseau que le reset des limites quotidiennes côté API.
export function todayParis(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ─── Statut des limites de geocoins (horaire / quotidienne) ───────────────────
// Détermine si le joueur a atteint une limite l'empêchant d'obtenir le prochain
// geocoin, et laquelle. Le quotidien prime (reset le plus lointain).
//   profile : { daily_cards, daily_reset_at, hourly_cards, cards_hour_reset_at, daily_shiny }
//   limits  : { quizDailyCardCap, quizHourlyCardCap, quizDailyShinyCap }
//   opts    : { shinyCard } — true si le geocoin en jeu est brillant : le cap
//     quotidien de shiny (quizDailyShinyCap) devient alors bloquant lui aussi.
//     Sans ça, un joueur à 5/5 shiny (geocoins jour/heure non pleins) répondait
//     sans choix dépôt/gloire et perdait le shiny en gloire silencieuse.
// Retourne { over, type: 'daily'|'shiny'|'hourly'|null, resetAt: Date|null, forgeCapped }
//   - daily  : resetAt = null (réinitialisation à minuit, géré à l'affichage)
//   - shiny  : resetAt = null (cap quotidien de shiny — minuit aussi)
//   - hourly : resetAt = Date de fin de la fenêtre horaire courante
//   - forgeCapped : le cap quotidien de PF de consolation est atteint
//     (hors-limite → plus aucun PF ni geocoin à gagner)
export function computeCardLimitStatus(profile, limits, opts = {}) {
  if (!profile) return { over: false, type: null, resetAt: null, forgeCapped: false }

  const today     = todayParis()
  const isNewDay  = !profile.daily_reset_at || profile.daily_reset_at < today
  // Caps effectifs — miroir du backend (utils/limits.js) : le sac (+1 geocoin/jour
  // par emplacement permanent) et les poches boostées du jour (+N geocoins/heure
  // jusqu'à minuit) s'ajoutent aux caps globaux. Un cap à 0 = illimité, jamais étendu.
  const baseDailyCap  = Number(limits?.quizDailyCardCap)  || 0
  const baseHourlyCap = Number(limits?.quizHourlyCardCap) || 0
  const bagSlots  = Math.max(0, Number(profile.bag_slots) || 0)
  const boost     = profile.pocket_boost_day === today ? Math.max(0, Number(profile.pocket_boost) || 0) : 0
  const dailyCap  = baseDailyCap  > 0 ? baseDailyCap  + bagSlots : baseDailyCap
  const hourlyCap = baseHourlyCap > 0 ? baseHourlyCap + boost    : baseHourlyCap

  // Cap quotidien de PF de consolation
  const forgeCap      = Number(limits?.quizDailyForgeCap) || 0
  const forgeConsumed = isNewDay ? 0 : (profile.daily_forge_consolation || 0)
  const forgeCapped   = forgeCap > 0 && forgeConsumed >= forgeCap

  // Limite quotidienne (prioritaire)
  const dailyCards = isNewDay ? 0 : (profile.daily_cards || 0)
  if (dailyCap > 0 && dailyCards >= dailyCap) {
    return { over: true, type: 'daily', resetAt: null, forgeCapped }
  }

  // Limite quotidienne de shiny — ne bloque QUE les geocoins brillants (miroir du
  // backend quiz.js : shinyCapReached). Avant l'horaire : les deux resets « jour »
  // (minuit) priment sur la fenêtre glissante d'une heure.
  const shinyCap   = Number(limits?.quizDailyShinyCap) || 0
  const dailyShiny = isNewDay ? 0 : (profile.daily_shiny || 0)
  if (opts.shinyCard && shinyCap > 0 && dailyShiny >= shinyCap) {
    return { over: true, type: 'shiny', resetAt: null, forgeCapped }
  }

  // Limite horaire (fenêtre glissante d'une heure ; un nouveau jour la réinitialise)
  const lastHourReset = profile.cards_hour_reset_at ? new Date(profile.cards_hour_reset_at).getTime() : null
  const hourlyReset   = isNewDay || !lastHourReset || (Date.now() - lastHourReset) >= 3600_000
  const hourlyCards   = hourlyReset ? 0 : (profile.hourly_cards || 0)
  if (hourlyCap > 0 && !hourlyReset && hourlyCards >= hourlyCap) {
    return { over: true, type: 'hourly', resetAt: new Date(lastHourReset + 3600_000), forgeCapped }
  }

  return { over: false, type: null, resetAt: null, forgeCapped }
}

export const DEFAULT_SHINY_SCORE_RULES = { commun: 2, rare: 6, épique: 14, légendaire: 40 }

export function collScore(col, pool, shinyCol = {}, rules = { commun: 1, rare: 3, épique: 7, légendaire: 20 }, shinyRules = DEFAULT_SHINY_SCORE_RULES) {
  const normal = Object.entries(col).reduce((sum, [id, n]) => {
    if (!n) return sum
    const c = pool.find(x => x.id === +id)
    return sum + (rules[c?.rarity] || 1)
  }, 0)
  const shiny = Object.entries(shinyCol).reduce((sum, [id, n]) => {
    if (!n) return sum
    const c = pool.find(x => x.id === +id)
    return sum + (shinyRules[c?.rarity] ?? (rules[c?.rarity] || 1) * 2)
  }, 0)
  return normal + shiny
}

// Fonctions utilitaires partagées entre les packs
function _byRarity(cardPool, r) { return cardPool.filter(c => c.rarity === r && c.type !== 'Achievement') }
function _pick(arr, fallback) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback }

// ─── Petit soutien : 2 communs, 2 rares, 1 épique ou rare (50/50) ─────────────
export function drawPackSmall(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const cards = []
  for (let i = 0; i < 2; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(epic, _pick(rare)) : _pick(rare, _pick(cardPool)))
  return cards
}

// ─── Soutien : 6 communs, 2 rares, 1 épique ou rare (50/50), 1 légen. ou épi. (50/50) ──
export function drawPackMedium(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const leg  = _byRarity(cardPool, 'légendaire')
  const cards = []
  for (let i = 0; i < 6; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(epic, _pick(rare)) : _pick(rare, _pick(cardPool)))
  cards.push(Math.random() < 0.5 ? _pick(leg, _pick(epic)) : _pick(epic, _pick(rare)))
  return cards
}

// ─── Gros soutien : 6 communs, 2 rares, 1 épique garantie, 1 légendaire garantie ──
export function drawPackLarge(cardPool) {
  const comm = _byRarity(cardPool, 'commun')
  const rare = _byRarity(cardPool, 'rare')
  const epic = _byRarity(cardPool, 'épique')
  const leg  = _byRarity(cardPool, 'légendaire')
  const cards = []
  for (let i = 0; i < 6; i++) cards.push(_pick(comm, _pick(cardPool)))
  for (let i = 0; i < 2; i++) cards.push(_pick(rare, _pick(cardPool)))
  cards.push(_pick(epic, _pick(rare)))
  cards.push(_pick(leg, _pick(epic)))
  return cards
}

// Rétrocompatibilité
export function drawPackCards(cardPool) { return drawPackMedium(cardPool) }

// ─── Tirage depuis une config de slots ───────────────────────────────────────
// slot: { rarity, qty?, alt?, chance? }
//   rarity  : rareté principale (garantie si pas de alt)
//   qty     : nombre de cartes de ce type (défaut 1)
//   alt     : rareté de repli (si défini → chance % d'obtenir rarity, sinon alt)
//   chance  : probabilité en % d'obtenir rarity (défaut 50)
export function drawPackFromConfig(cardPool, slots) {
  const eligible = cardPool.filter(c => !c.forgeable && !c.type?.toLowerCase().startsWith('achievement'))
  const by   = r   => eligible.filter(c => c.rarity === r)
  const pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : eligible[Math.floor(Math.random() * eligible.length)]
  const cards = []
  for (const s of (slots || [])) {
    for (let i = 0; i < (s.qty || 1); i++) {
      const rarity = s.alt
        ? (Math.random() * 100 < (s.chance ?? 50) ? s.rarity : s.alt)
        : s.rarity
      cards.push(pick(by(rarity)))
    }
  }
  return cards
}

const R_ICON  = { légendaire: '🟠', épique: '🟣', rare: '🔵', commun: '⚪' }
const R_LABEL = { légendaire: 'Légendaire', épique: 'Épique', rare: 'Rare', commun: 'Commun' }

// Convertit une liste de slots en libellés affichables
// t est optionnel : si fourni, utilise les clés i18n pack_guaranteed / pack_or_higher / pack_chance_note
export function slotsToContents(slots, t) {
  return (slots || []).map(s => {
    const qty = s.qty || 1
    const rKey   = r => 'rarity_' + r.replace(/[éèêëàâùûîïôœæç]/g, c => ({ é:'e',è:'e',ê:'e',ë:'e',à:'a',â:'a',ù:'u',û:'u',î:'i',ï:'i',ô:'o',œ:'oe',æ:'ae',ç:'c' })[c] || c)
    const rLabel = r => (t ? t(rKey(r)) : null) || R_LABEL[r] || r
    if (s.alt) {
      const label = t
        ? t('pack_or_higher').replace('{qty}', qty).replace('{rarity}', rLabel(s.alt))
        : `${qty} ${R_LABEL[s.alt] || s.alt} ou supérieure`
      const note = t
        ? t('pack_chance_note').replace('{pct}', s.chance ?? 50).replace('{rarity}', rLabel(s.rarity))
        : `${s.chance ?? 50}% ${R_LABEL[s.rarity] || s.rarity}`
      return { icon: R_ICON[s.alt] || '⚪', label, note }
    }
    const label = t
      ? t('pack_guaranteed').replace('{qty}', qty).replace('{rarity}', rLabel(s.rarity))
      : `${qty} ${R_LABEL[s.rarity] || s.rarity}${qty > 1 ? 's' : ''} garanti${qty > 1 ? 's' : 'e'}`
    return { icon: R_ICON[s.rarity] || '⚪', label }
  })
}

// Génère une miniature parfaite (100x140) centrée sur le haut de l'image (cover 25%)
export function createCardThumbnail(file, targetWidth = 100, targetHeight = 140) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // Cadrage "cover" avec centrage
      const imgRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;
      if (imgRatio > targetRatio) {
        const drawWidth = img.height * targetRatio;
        const offsetX = (img.width - drawWidth) / 2;
        ctx.drawImage(img, offsetX, 0, drawWidth, img.height, 0, 0, targetWidth, targetHeight);
      } else {
        const drawHeight = img.width / targetRatio;
        const offsetY = (img.height - drawHeight) * 0.25; // Focus sur le haut (comme le CSS 25%)
        ctx.drawImage(img, 0, offsetY, img.width, drawHeight, 0, 0, targetWidth, targetHeight);
      }

      canvas.toBlob(blob => {
        // Remplace l'extension d'origine par _thumb.webp
        const newName = file.name.replace(/\.[^/.]+$/, "") + "_thumb.webp";
        const newFile = new File([blob], newName, { type: 'image/webp' });
        resolve(newFile);
      }, 'image/webp', 0.85); // WebP à 85% = qualité parfaite et poids minuscule (< 5ko)
    };
    img.onerror = error => reject(error);
  });
}
