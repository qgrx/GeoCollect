/**
 * Client API — wraps fetch avec le token Supabase.
 * Toutes les fonctions retournent { data, error }.
 *
 * Si VITE_API_URL n'est pas défini, retourne { data: null, error: 'no_api' }
 * et le frontend reste en mode local (state React).
 */
import { supabase } from '../lib/supabase.js'

const _rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const API_URL    = _rawApiUrl || 'http://localhost:3001'
export const API_ENABLED = !!_rawApiUrl

// ─── Limiteur de concurrence ────────────────────────────────────────────────────
// Au chargement de l'app, une douzaine de requêtes sont déclenchées en parallèle
// (collection, market, cards, quêtes, trésor, saison, ...). Au-delà d'une poignée
// de connexions simultanées, le pool de connexions Supabase côté API sature et les
// temps de réponse explosent en cascade (jusqu'à 15-20s sur les dernières requêtes).
// On limite donc le nombre de requêtes API en vol en même temps ; les suivantes
// attendent leur tour dans une file.
const MAX_CONCURRENT_REQUESTS = 4
let activeRequests = 0
const requestQueue = []

function runQueuedRequests() {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length) {
    const task = requestQueue.shift()
    activeRequests++
    task().finally(() => { activeRequests--; runQueuedRequests() })
  }
}

function withConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push(() => task().then(resolve, reject))
    runQueuedRequests()
  })
}

// ─── Helper fetch ─────────────────────────────────────────────────────────────
// `fetch` n'a AUCUN timeout natif : sur mobile (bascule 4G/Wi-Fi, veille radio,
// onglet gelé puis réveillé) une requête peut rester en vol indéfiniment. Elle
// bloque alors une des places du limiteur ci-dessus ET fige définitivement tout
// appelant qui attend sa promesse — c'est ce qui laissait le compteur du prochain
// quiz bloqué sur « ··· » (son poll ne se déverrouillait jamais) jusqu'au
// rechargement de l'app. On borne donc toute requête ; `timeoutMs` permet de
// rallonger ponctuellement (traitements admin par lots).
const REQUEST_TIMEOUT_MS = 30_000
// getSession() n'est pas qu'une lecture de storage : token expiré ⇒ rafraîchissement
// RÉSEAU (et verrou inter-onglets). Sur une connexion instable il peut ne jamais
// rendre la main — et comme il s'exécute AVANT fetch, la requête reste bloquée sans
// même bénéficier du timeout ci-dessus (« ⏳ Validation côté serveur en cours… » qui
// ne revient jamais). On le borne donc aussi.
const AUTH_TIMEOUT_MS = 8_000

async function apiFetch(path, options = {}) {
  if (!API_ENABLED) return { data: null, error: 'api_not_configured' }
  let token = null

  // Récupérer le token Supabase si disponible
  if (supabase) {
    const session = await Promise.race([
      supabase.auth.getSession().then(r => r?.data?.session || null).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve('timeout'), AUTH_TIMEOUT_MS)),
    ])
    // Session injoignable : mieux vaut une erreur explicite (l'appelant peut réessayer)
    // qu'un appel sans jeton, qui reviendrait en 401 et ferait perdre le round.
    if (session === 'timeout') return { data: null, error: 'timeout' }
    token = session?.access_token || null
  }

  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options

  return withConcurrencyLimit(async () => {
    const ctl   = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        ...(ctl ? { signal: ctl.signal } : {}),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(fetchOptions.headers || {}),
        },
        body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
      })

      const json = await res.json()
      if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}`, status: res.status, body: json }
      return { data: json, error: null, status: res.status }
    } catch (err) {
      // Abort = timeout : erreur explicite plutôt que « The user aborted a request »
      const message = err.name === 'AbortError' ? 'timeout' : err.message
      if (import.meta.env.DEV) console.warn(`[API] ${path} failed:`, message)
      return { data: null, error: message }
    } finally {
      if (timer) clearTimeout(timer)
    }
  })
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export const apiGetCards = () => apiFetch('/api/cards')
// Nombre de collectionneurs par geocoin (public, mis en cache 10 min côté API).
export const apiGetCardOwners = () => apiFetch('/api/cards/owners')

// ─── Collection ───────────────────────────────────────────────────────────────
export const apiGetCollection   = ()          => apiFetch('/api/collection')
export const apiGetUserCollection = (userId)  => apiFetch(`/api/collection/${userId}`)

// ─── Market ───────────────────────────────────────────────────────────────────
export const apiGetMarket     = () => apiFetch('/api/market')
export const apiGetPriceCaps  = () => apiFetch('/api/market/price-caps')

export const apiGetMyListings = () => apiFetch('/api/market/my')

export const apiBuyCard = (listingId) =>
  apiFetch('/api/market/buy', { method: 'POST', body: { listing_id: listingId } })

export const apiListCard = (cardId, price) =>
  apiFetch('/api/market/list', { method: 'POST', body: { card_id: cardId, price } })

export const apiCancelListing = (id) =>
  apiFetch(`/api/market/${id}`, { method: 'DELETE' })

// ─── Marché « Hors saison » (geocoins de saisons terminées, vendus par le jeu) ─
export const apiGetOffseasonMarket = () => apiFetch('/api/market/offseason')

export const apiBuyOffseasonCard = (card_id) =>
  apiFetch('/api/market/offseason/buy', { method: 'POST', body: { card_id } })

// ─── Quiz ─────────────────────────────────────────────────────────────────────
// Chemin CHRONOMÉTRÉ : un round se joue à la seconde. Attendre 30 s une réponse qui
// ne viendra pas, c'est le round perdu — on échoue vite pour laisser la revalidation
// automatique de la modale rejouer la réponse (le serveur est idempotent).
const QUIZ_TIMEOUT_MS = 10_000

export const apiGetCurrentQuiz  = () => apiFetch('/api/quiz/current', { timeoutMs: QUIZ_TIMEOUT_MS })
export const apiGetQuizHistory  = (limit = 10) => apiFetch(`/api/quiz/history?limit=${limit}`)

export const apiJoinQuiz = (quizId) =>
  apiFetch('/api/quiz/join', { method: 'POST', timeoutMs: QUIZ_TIMEOUT_MS, body: { quiz_id: quizId } })

export const apiAnswerQuiz = (quizId, answer, nonce, choice, holdAction) =>
  apiFetch('/api/quiz/answer', { method: 'POST', timeoutMs: QUIZ_TIMEOUT_MS, body: { quiz_id: quizId, answer, ...(nonce ? { nonce } : {}), ...(choice ? { choice } : {}),
    // Dépôt payant (précieux déjà possédé, hors-limite) : méthode choisie explicitement
    // dans le sélecteur — remplacer un geocoin désigné OU louer un emplacement.
    ...(holdAction?.rent ? { hold_rent: true } : {}),
    ...(holdAction?.replaceId != null ? { hold_replace_id: holdAction.replaceId } : {}) } })

// ─── Quiz — Mode Débutant ───────────────────────────────────────────────────
export const apiGetBeginnerQuiz     = () => apiFetch('/api/quiz/beginner/current')
export const apiGetBeginnerHistory  = (limit = 10) => apiFetch(`/api/quiz/beginner/history?limit=${limit}&_=${Date.now()}`)
export const apiAnswerBeginnerQuiz  = (quizId, answer) =>
  apiFetch('/api/quiz/beginner/answer', { method: 'POST', body: { quiz_id: quizId, answer } })

export const apiReportQuestion      = (questionId) =>
  apiFetch(`/api/quiz/questions/${questionId}/report`, { method: 'POST' })
export const apiResetQuestionReports = (questionId) =>
  apiFetch(`/api/admin/questions/${questionId}/reports`, { method: 'DELETE' })

// ─── Démo / onboarding (sans compte — geocoins en localStorage) ───────────────
// GET public : 5 étapes AVEC réponses (validation côté client) + faux feed + totaux.
export const apiGetDemo   = ()        => apiFetch('/api/demo')
// Après création d'un vrai compte : crédite les geocoins démo gagnés (filtrés serveur).
export const apiDemoClaim = (cardIds) => apiFetch('/api/demo/claim', { method: 'POST', body: { card_ids: cardIds } })

// ─── Transactions ─────────────────────────────────────────────────────────────
export const apiGetTransactions = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/transactions${qs ? '?' + qs : ''}`)
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export const apiGetProfile    = ()         => apiFetch('/api/profile')
export const apiUpdatePseudo  = (pseudo)   => apiFetch('/api/profile/pseudo', { method: 'PATCH', body: { pseudo } })
export const apiPingProfile     = ()       => apiFetch('/api/profile/ping',    { method: 'POST' })
export const apiDeleteAccount   = ()       => apiFetch('/api/profile/account',      { method: 'DELETE' })
export const apiWelcomeCard     = ()       => apiFetch('/api/profile/welcome-card', { method: 'POST' })
export const apiOnboardingDone       = ()  => apiFetch('/api/profile/onboarding-done', { method: 'POST' })
export const apiResetAchievements    = ()  => apiFetch('/api/achievements/reset', { method: 'DELETE' })
// pseudo optionnel : requis (409 sinon) quand le pseudo d'origine a été repris par un compte actif
export const apiAdminReactivate         = (id, pseudo)  => apiFetch(`/api/admin/players/${id}/reactivate`, { method: 'PATCH', ...(pseudo ? { body: { pseudo } } : {}) })
export const apiAdminResetOnboarding    = (id)          => apiFetch(`/api/admin/players/${id}/reset-onboarding`, { method: 'PATCH' })
export const apiAdminSetGold             = (id, gold)         => apiFetch(`/api/admin/players/${id}/gold`, { method: 'PATCH', body: { gold } })
export const apiAdminSetForgePoints      = (id, forge_points) => apiFetch(`/api/admin/players/${id}/forge-points`, { method: 'PATCH', body: { forge_points } })
export const apiAdminSetPlayerLimits     = (id, limits)       => apiFetch(`/api/admin/players/${id}/limits`, { method: 'PATCH', body: limits })
export const apiAdminSetWeeklyMax        = (id, reset = false) => apiFetch(`/api/admin/players/${id}/weekly-max`, { method: 'POST', body: { reset } })
export const apiAdminSetPseudo           = (id, pseudo)       => apiFetch(`/api/admin/players/${id}/pseudo`, { method: 'PATCH', body: { pseudo } })
export const apiAdminGetPlayerCollection = (id)               => apiFetch(`/api/admin/players/${id}/collection`)
export const apiAdminGetPlayerSpending   = (id, page = 0, currency = '') => apiFetch(`/api/admin/players/${id}/spending?page=${page}${currency ? '&currency=' + currency : ''}`)
export const apiAdminGetCheatReport      = (id)               => apiFetch(`/api/admin/players/${id}/cheat-report`)
export const apiAdminGetCheatSuspects    = (min = 1)          => apiFetch(`/api/admin/cheat/suspects?min=${min}`)
export const apiAdminGetSharedIps        = ()                 => apiFetch('/api/admin/cheat/shared-ips')
export const apiAdminGiveCard            = (id, card_id, quantity = 1, is_shiny = false) => apiFetch(`/api/admin/players/${id}/cards`, { method: 'POST', body: { card_id, quantity, is_shiny } })
export const apiAdminTakeCard            = (id, card_id, quantity = 1, is_shiny = false) => apiFetch(`/api/admin/players/${id}/cards/${card_id}`, { method: 'DELETE', body: { quantity, is_shiny } })
export const apiAdminUndoForgeShiny      = (id, card_id) => apiFetch(`/api/admin/players/${id}/undo-forge-shiny`, { method: 'POST', body: { card_id } })

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const apiGetLeaderboard = (page = 0, q) => apiFetch(`/api/leaderboard?page=${page}${q ? '&q=' + encodeURIComponent(q) : ''}`)

// ─── Admin config ────────────────────────────────────────────────────────────
export const apiAdminAnnounce         = (message, type = 'info') => apiFetch('/api/admin/announce', { method: 'POST', body: { message, type } })
export const apiPublishReleaseNote    = (version)               => apiFetch('/api/admin/docs/release-notes/publish', { method: 'POST', body: { version } })
export const apiTriggerQuiz           = () => apiFetch('/api/admin/quiz/trigger', { method: 'POST' })
export const apiTriggerShinyQuiz      = () => apiFetch('/api/admin/quiz/trigger-shiny', { method: 'POST' })
export const apiAdminGetVersion       = () => apiFetch('/api/admin/version')
export const apiAdminGetQuestions       = ()                         => apiFetch('/api/admin/questions')
export const apiAdminAddQuestion        = (q, a, translations, alt_answers, hidden = false, hint = '', publish_at = null) => apiFetch('/api/admin/questions', { method: 'POST', body: { question: q, answer: a, hint: hint || '', translations: translations || {}, alt_answers: alt_answers || [], hidden, publish_at } })
// Imports par lots / purges massives : plus lents que le timeout standard.
export const apiAdminBatchAddQuestions  = (questions, hidden)        => apiFetch('/api/admin/questions/batch', { method: 'POST', timeoutMs: 180_000, body: { questions, ...(hidden !== undefined ? { hidden } : {}) } })
export const apiAdminDeleteAllQuestions = ()                         => apiFetch('/api/admin/questions', { method: 'DELETE', timeoutMs: 180_000 })
export const apiAdminDeleteDraftQuestions     = ()                   => apiFetch('/api/admin/questions/drafts', { method: 'DELETE', timeoutMs: 180_000 })
export const apiAdminDeletePublishedQuestions = ()                   => apiFetch('/api/admin/questions/published', { method: 'DELETE', timeoutMs: 180_000 })
export const apiAdminEditQuestion       = (id, q, a)                 => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { question: q, answer: a } })
export const apiAdminEditFullQuestion   = (id, fields)               => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { question: fields.q, answer: fields.a, hint: fields.hint || '', alt_answers: fields.alt_answers || [], ...(fields.hidden !== undefined ? { hidden: fields.hidden } : {}), ...(fields.publish_at !== undefined ? { publish_at: fields.publish_at } : {}) } })
export const apiAdminToggleQuestion     = (id, active)               => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { active } })
export const apiAdminSaveTranslations      = (id, translations)       => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { translations } })
export const apiAdminSaveCardNameTrans     = (id, name_translations)  => apiFetch(`/api/admin/cards/${id}/name-translations`, { method: 'PATCH', body: { name_translations } })
export const apiAdminSaveCardDescTrans     = (id, description_translations) => apiFetch(`/api/admin/cards/${id}/description-translations`, { method: 'PATCH', body: { description_translations } })
// Description longue = fiche publique du geocoin (SEO), distincte de la courte
// affichée sur la carte. Texte source et traductions passent par la même route.
export const apiAdminSaveCardLongDesc      = (id, description_long, description_long_translations) => apiFetch(`/api/admin/cards/${id}/long-description`, { method: 'PATCH', body: { description_long, description_long_translations } })
// Fiche d'une cache sur geocaching.com, lue par l'API avec son compte de
// service : alimente le bouton « ⤓ Remplir » du formulaire de carte. Lecture
// seule — c'est l'admin qui enregistre ensuite ce qu'il a relu.
export const apiAdminLookupGeocache        = (code) => apiFetch(`/api/admin/geocache/${encodeURIComponent(code)}`)
export const apiGetPublicConfig       = () => apiFetch('/api/config')
export const apiGetAdminConfig        = () => apiFetch('/api/admin/config')
export const apiAdminGetMarketHistory = (params = {}) => { const qs = new URLSearchParams(params).toString(); return apiFetch(`/api/admin/market-history${qs ? '?' + qs : ''}`) }
export const apiAdminGetMarketVolume  = (params = {}) => { const qs = new URLSearchParams(params).toString(); return apiFetch(`/api/admin/market-volume${qs ? '?' + qs : ''}`) }
export const apiAdminGetCardQuizStats = () => apiFetch('/api/admin/cards/quiz-stats')
export const apiAdminGetReferrals     = () => apiFetch('/api/admin/referrals')
export const apiAdminGetPatronageStats = () => apiFetch('/api/admin/patronage-stats')
export const apiAdminAssignReferral   = (filleulId, parrainId) => apiFetch(`/api/admin/referrals/${filleulId}`, { method: 'PATCH', body: { parrain_id: parrainId } })
export const apiAdminUnassignReferral = (filleulId)            => apiFetch(`/api/admin/referrals/${filleulId}`, { method: 'DELETE' })
export const apiAdminSearchPlayers    = (q)                    => apiFetch(`/api/admin/players?page=0&q=${encodeURIComponent(q)}`)
export const apiAdminFlushCache         = () => apiFetch('/api/admin/cache/flush', { method: 'DELETE' })
export const apiAdminRecalculateScores  = () => apiFetch('/api/admin/recalculate-scores', { method: 'POST', timeoutMs: 180_000 })

// ─── Trésors ──────────────────────────────────────────────────────────────────
export const apiGetDailyTreasure   = () => apiFetch('/api/treasures/daily')
export const apiClaimDailyTreasure = () => apiFetch('/api/treasures/daily/claim', { method: 'POST' })

// ─── Dépôt d'Attente ─────────────────────────────────────────────────────────
export const apiGetHold   = ()                          => apiFetch('/api/hold')
export const apiStoreHold = (card_id, is_shiny, rent, replace_id) => apiFetch('/api/hold', { method: 'POST', body: { card_id, is_shiny, rent, replace_id } })
export const apiClaimHold = (hold_id)                   => apiFetch('/api/hold/claim', { method: 'POST', body: { hold_id } })
export const apiBuyHoldSlot  = ()                       => apiFetch('/api/hold/slots/buy', { method: 'POST' })
export const apiRentHoldSlot = ()                       => apiFetch('/api/hold/slots/rent', { method: 'POST' })
export const apiTakeForgeInsteadOfHold = (card_id, is_shiny) => apiFetch('/api/hold/forge-point', { method: 'POST', body: { card_id, is_shiny } })

// ─── Mécénat (offrir un geocoin qu'on ne peut plus acquérir) ──────────────────
export const apiPatronageDonate  = (quiz_id, criterion) => apiFetch('/api/patronage/donate', { method: 'POST', body: { quiz_id, criterion } })
export const apiPatronageDonateDuplicate = (card_id, criterion) => apiFetch('/api/patronage/donate-duplicate', { method: 'POST', body: { card_id, criterion } })
export const apiGetPatronagePending = ()                => apiFetch('/api/patronage/pending')

// ─── Limites — agrandir les poches (horaire) / le sac (quotidien) ─────────────
export const apiBuyPocketBoost = () => apiFetch('/api/limits/pocket/boost', { method: 'POST' })
export const apiBuyBagSlot     = () => apiFetch('/api/limits/bag/buy', { method: 'POST' })
export const apiBuyShinyBagSlot = () => apiFetch('/api/limits/shiny-bag/buy', { method: 'POST' })
export const apiAdminGetStats         = () => apiFetch('/api/admin/stats')
export const apiAdminGetOnlineHistory = (hours = 24) => apiFetch(`/api/admin/online-history?hours=${hours}`)
export const apiAdminGetSignupsHistory = (days = 30) => apiFetch(`/api/admin/signups-history?days=${days}`)
export const apiAdminGetGeocoinsPerPlayer = () => apiFetch('/api/admin/geocoins-per-player')
export const apiAdminGetBots          = () => apiFetch('/api/admin/bots')
export const apiAdminCreateBot        = (body) => apiFetch('/api/admin/bots', { method: 'POST', body })
export const apiAdminUpdateBot        = (id, body) => apiFetch(`/api/admin/bots/${id}`, { method: 'PATCH', body })
export const apiAdminDeleteBot        = (id) => apiFetch(`/api/admin/bots/${id}`, { method: 'DELETE' })
export const apiAdminCancelListing    = (id) => apiFetch(`/api/admin/listings/${id}`, { method: 'DELETE' })
export const apiAdminGetListings      = (params = {}) => { const qs = new URLSearchParams(params).toString(); return apiFetch(`/api/admin/listings${qs ? '?' + qs : ''}`) }
export const apiAdminPurgeOrphans     = () => apiFetch('/api/admin/listings/purge-orphans', { method: 'DELETE' })
export const apiAdminPurgeExpired     = (days) => apiFetch(`/api/admin/listings/purge-expired?days=${days}`, { method: 'DELETE' })
export const apiAdminDiagnoseListings = () => apiFetch('/api/admin/listings/diagnose')
export const apiAdminSetCanSell       = (userId, can_sell) => apiFetch(`/api/admin/players/${userId}/can-sell`, { method: 'PATCH', body: { can_sell } })
export const apiAdminRenameType       = (oldType, newType) => apiFetch('/api/admin/cards/type/rename', { method: 'PATCH', body: { oldType, newType } })
export const apiAdminDeleteType       = (type) => apiFetch(`/api/admin/cards/type/${encodeURIComponent(type)}`, { method: 'DELETE' })
export const apiAdminDeleteCard       = (id)   => apiFetch(`/api/cards/${id}`, { method: 'DELETE' })
export const apiGetReferral            = ()       => apiFetch('/api/referral/me')
export const apiClaimReferral          = (code)   => apiFetch('/api/referral/claim', { method: 'POST', body: { code } })
export const apiGetGeocaching          = ()        => apiFetch('/api/geocaching/me')
// Vérification = connexion + scraping de geocaching.com (site externe, parfois lent).
export const apiVerifyGeocaching       = ()        => apiFetch('/api/geocaching/verify', { method: 'POST', timeoutMs: 120_000 })
export const apiGetAchievements        = ()       => apiFetch('/api/achievements')
export const apiGetDailyAchievements   = ()       => apiFetch('/api/achievements/daily')
export const apiGetDailyQuests         = ()       => apiFetch('/api/quests/daily')
export const apiQuestCheckin           = ()       => apiFetch('/api/quests/checkin', { method: 'POST' })
export const apiRerollDailyQuest       = (questId) => apiFetch('/api/quests/reroll', { method: 'POST', body: { quest_id: questId } })
export const apiGetWeeklyQuests        = ()       => apiFetch('/api/quests/weekly')
export const apiRerollWeeklyQuest      = (questId) => apiFetch('/api/quests/weekly/reroll', { method: 'POST', body: { quest_id: questId } })
export const apiForgeCard              = (cardId) => apiFetch(`/api/forge/${cardId}`, { method: 'POST' })
export const apiForgeShiny             = (cardId) => apiFetch('/api/forge/shiny', { method: 'POST', body: { cardId } })
export const apiMeltCard               = (cardId) => apiFetch(`/api/forge/melt/${cardId}`, { method: 'POST' })
export const apiMeltShinyCard          = (cardId) => apiFetch(`/api/forge/melt-shiny/${cardId}`, { method: 'POST' })
export const apiMeltAllCards            = ()       => apiFetch('/api/forge/melt-all', { method: 'POST' })
export const apiMeltAllShinyCards       = ()       => apiFetch('/api/forge/melt-all-shiny', { method: 'POST' })
export const apiGetAdminDailyQuests    = ()       => apiFetch('/api/admin/daily-quests')
export const apiCreateAdminDailyQuest  = (body)   => apiFetch('/api/admin/daily-quests', { method: 'POST', body })
export const apiUpdateAdminDailyQuest  = (id, body) => apiFetch(`/api/admin/daily-quests/${id}`, { method: 'PATCH', body })
export const apiDeleteAdminDailyQuest  = (id)     => apiFetch(`/api/admin/daily-quests/${id}`, { method: 'DELETE' })
export const apiRegenerateDailySchedule = (date)  => apiFetch('/api/admin/daily-quests/schedule/regenerate', { method: 'POST', body: { date } })
// Remplace UNE quête du planning du jour (les deux autres et leurs progressions
// sont conservées), contrairement à la régénération qui re-tire les trois.
export const apiReplaceDailyScheduled  = (questId, date) => apiFetch('/api/admin/daily-quests/schedule/replace', { method: 'POST', body: { quest_id: questId, date } })
export const apiGetDailySchedule       = (date)   => apiFetch(`/api/admin/daily-quests/schedule${date ? '?date=' + date : ''}`)
export const apiGetAdminWeeklyQuests   = ()       => apiFetch('/api/admin/weekly-quests')
export const apiCreateAdminWeeklyQuest = (body)   => apiFetch('/api/admin/weekly-quests', { method: 'POST', body })
export const apiUpdateAdminWeeklyQuest = (id, body) => apiFetch(`/api/admin/weekly-quests/${id}`, { method: 'PATCH', body })
export const apiDeleteAdminWeeklyQuest = (id)     => apiFetch(`/api/admin/weekly-quests/${id}`, { method: 'DELETE' })
export const apiRegenerateWeeklySchedule = (weekStart) => apiFetch('/api/admin/weekly-quests/schedule/regenerate', { method: 'POST', body: { week_start: weekStart } })
export const apiGetWeeklySchedule      = (weekStart) => apiFetch(`/api/admin/weekly-quests/schedule${weekStart ? '?week_start=' + weekStart : ''}`)
export const apiGetAchievementDefs     = ()       => apiFetch('/api/admin/achievement-definitions')
export const apiGetAchievementDefStats = ()       => apiFetch('/api/admin/achievement-definitions/stats')
export const apiCreateAchievementDef   = (body)   => apiFetch('/api/admin/achievement-definitions', { method: 'POST', body })
export const apiUpdateAchievementDef   = (id, body) => apiFetch(`/api/admin/achievement-definitions/${id}`, { method: 'PATCH', body })
export const apiDeleteAchievementDef   = (id)     => apiFetch(`/api/admin/achievement-definitions/${id}`, { method: 'DELETE' })
export const apiAdminGetCards         = () => apiFetch('/api/admin/cards')
// Force le Deploy Hook Vercel : les fiches /geocoins/… sont des pages statiques
// figées au dernier build, et rien ne le relance automatiquement pour elles.
export const apiAdminDeployFrontend   = (reason) => apiFetch('/api/admin/deploy-frontend', { method: 'POST', body: { reason } })
export const apiReleaseHiddenCards    = () => apiFetch('/api/admin/cards/release-hidden', { method: 'POST' })
// Publication d'une sélection de cartes cachées : publish_at null → tout de suite,
// publish_at ISO futur → programmation (le cardPublishScheduler s'en charge).
export const apiAdminPublishCards     = (ids, publish_at = null) => apiFetch('/api/admin/cards/publish', { method: 'POST', body: { ids, publish_at } })
export const apiAdminUnscheduleCards  = (ids) => apiFetch('/api/admin/cards/unschedule', { method: 'POST', body: { ids } })
export const apiReleaseHiddenQuestions = () => apiFetch('/api/admin/questions/release-hidden', { method: 'POST' })
export const apiReleaseHiddenAchievements = () => apiFetch('/api/admin/achievement-definitions/release-hidden', { method: 'POST' })
export const apiAdminAddCard          = (card) => apiFetch('/api/admin/cards', { method: 'POST', body: card })
export const apiAdminEditCard         = (id, card) => apiFetch(`/api/admin/cards/${id}`, { method: 'PATCH', body: card })
export const apiGetAchievementCards   = () => apiFetch('/api/admin/achievements')
export const apiEditAchievementCard   = (id, body) => apiFetch(`/api/admin/achievements/${id}`, { method: 'PATCH', body })
export const apiGetAdminTransactions  = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiFetch(`/api/admin/transactions${qs ? '?' + qs : ''}`)
}

export const apiSetConfig = (key, value) =>
  apiFetch(`/api/admin/config/${key}`, { method: 'PATCH', body: { value } })

// ─── Boutique ─────────────────────────────────────────────────────────────────
export const apiGetAdminShopPacks    = ()           => apiFetch('/api/admin/shop-packs')
export const apiUpdateAdminShopPacks = (packs)      => apiFetch('/api/admin/shop-packs', { method: 'PATCH', body: { packs } })
export const apiCreateCheckout       = (pack_id)    => apiFetch('/api/shop/checkout', { method: 'POST', body: { pack_id } })
export const apiGetPurchase          = (checkoutId) => apiFetch(`/api/shop/purchase/${checkoutId}`)

// ─── Docs (FAQ / Release Notes / Support) ────────────────────────────────────
export const apiGetDocsPage   = (page, lang)          => apiFetch(`/api/docs/${page}${lang ? `?lang=${lang}` : ''}`)
export const apiSaveDocsPage  = (page, content, lang) => apiFetch(`/api/docs/${page}`, { method: 'PATCH', body: { content, lang } })

// ─── Jeu Quotidien ────────────────────────────────────────────────────────────
export const apiGetJeuQuotidien = () => apiFetch('/api/jeu/quotidien')
export const apiAdminSeedJeu    = () => apiFetch('/api/admin/jeu/seed', { method: 'POST' })

// ─── Saisons ──────────────────────────────────────────────────────────────────
export const apiGetSeasons            = ()         => apiFetch('/api/seasons')
export const apiGetCurrentSeason      = ()         => apiFetch('/api/seasons/current')
export const apiMarkSeasonSeen        = ()         => apiFetch('/api/seasons/current/seen', { method: 'POST' })
export const apiGetAdminSeasons       = ()         => apiFetch('/api/admin/seasons')
export const apiCreateAdminSeason     = (body)     => apiFetch('/api/admin/seasons', { method: 'POST', body })
export const apiUpdateAdminSeason     = (id, body) => apiFetch(`/api/admin/seasons/${id}`, { method: 'PATCH', body })
export const apiDeleteAdminSeason     = (id)       => apiFetch(`/api/admin/seasons/${id}`, { method: 'DELETE' })
