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

// ─── Helper fetch ─────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  if (!API_ENABLED) return { data: null, error: 'api_not_configured' }
  let token = null

  // Récupérer le token Supabase si disponible
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token || null
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}`, status: res.status }
    return { data: json, error: null, status: res.status }
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[API] ${path} failed:`, err.message)
    return { data: null, error: err.message }
  }
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export const apiGetCards = () => apiFetch('/api/cards')

// ─── Collection ───────────────────────────────────────────────────────────────
export const apiGetCollection   = ()          => apiFetch('/api/collection')
export const apiGetUserCollection = (userId)  => apiFetch(`/api/collection/${userId}`)

// ─── Market ───────────────────────────────────────────────────────────────────
export const apiGetMarket = () => apiFetch('/api/market')

export const apiGetMyListings = () => apiFetch('/api/market/my')

export const apiBuyCard = (listingId) =>
  apiFetch('/api/market/buy', { method: 'POST', body: { listing_id: listingId } })

export const apiListCard = (cardId, price) =>
  apiFetch('/api/market/list', { method: 'POST', body: { card_id: cardId, price } })

export const apiCancelListing = (id) =>
  apiFetch(`/api/market/${id}`, { method: 'DELETE' })

// ─── Quiz ─────────────────────────────────────────────────────────────────────
export const apiGetCurrentQuiz  = () => apiFetch('/api/quiz/current')
export const apiGetQuizHistory  = (limit = 10) => apiFetch(`/api/quiz/history?limit=${limit}`)

export const apiJoinQuiz = (quizId) =>
  apiFetch('/api/quiz/join', { method: 'POST', body: { quiz_id: quizId } })

export const apiAnswerQuiz = (quizId, answer) =>
  apiFetch('/api/quiz/answer', { method: 'POST', body: { quiz_id: quizId, answer } })

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
export const apiAdminReactivate         = (id)          => apiFetch(`/api/admin/players/${id}/reactivate`, { method: 'PATCH' })
export const apiAdminResetOnboarding    = (id)          => apiFetch(`/api/admin/players/${id}/reset-onboarding`, { method: 'PATCH' })
export const apiAdminSetGold             = (id, gold)    => apiFetch(`/api/admin/players/${id}/gold`, { method: 'PATCH', body: { gold } })
export const apiAdminGetPlayerCollection = (id)          => apiFetch(`/api/admin/players/${id}/collection`)
export const apiAdminGiveCard            = (id, card_id) => apiFetch(`/api/admin/players/${id}/cards`, { method: 'POST', body: { card_id } })
export const apiAdminTakeCard            = (id, card_id) => apiFetch(`/api/admin/players/${id}/cards/${card_id}`, { method: 'DELETE' })

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const apiGetLeaderboard = (page = 0, q) => apiFetch(`/api/leaderboard?page=${page}${q ? '&q=' + encodeURIComponent(q) : ''}`)

// ─── Admin config ────────────────────────────────────────────────────────────
export const apiAdminAnnounce         = (message, type = 'info') => apiFetch('/api/admin/announce', { method: 'POST', body: { message, type } })
export const apiTriggerQuiz           = () => apiFetch('/api/admin/quiz/trigger', { method: 'POST' })
export const apiTriggerShinyQuiz      = () => apiFetch('/api/admin/quiz/trigger-shiny', { method: 'POST' })
export const apiAdminGetQuestions       = ()                         => apiFetch('/api/admin/questions')
export const apiAdminAddQuestion        = (q, a, translations)       => apiFetch('/api/admin/questions', { method: 'POST', body: { question: q, answer: a, hint: '', translations: translations || {} } })
export const apiAdminBatchAddQuestions  = (questions)                => apiFetch('/api/admin/questions/batch', { method: 'POST', body: { questions } })
export const apiAdminDeleteAllQuestions = ()                         => apiFetch('/api/admin/questions', { method: 'DELETE' })
export const apiAdminEditQuestion       = (id, q, a)                 => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { question: q, answer: a } })
export const apiAdminToggleQuestion     = (id, active)               => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { active } })
export const apiAdminSaveTranslations      = (id, translations)       => apiFetch(`/api/admin/questions/${id}`, { method: 'PATCH', body: { translations } })
export const apiAdminSaveCardNameTrans     = (id, name_translations)  => apiFetch(`/api/admin/cards/${id}/name-translations`, { method: 'PATCH', body: { name_translations } })
export const apiGetPublicConfig       = () => apiFetch('/api/config')
export const apiGetAdminConfig        = () => apiFetch('/api/admin/config')
export const apiAdminGetMarketHistory = (params = {}) => { const qs = new URLSearchParams(params).toString(); return apiFetch(`/api/admin/market-history${qs ? '?' + qs : ''}`) }
export const apiAdminGetCardQuizStats = () => apiFetch('/api/admin/cards/quiz-stats')
export const apiAdminFlushCache         = () => apiFetch('/api/admin/cache/flush', { method: 'DELETE' })
export const apiAdminRecalculateScores  = () => apiFetch('/api/admin/recalculate-scores', { method: 'POST' })

// ─── Trésors ──────────────────────────────────────────────────────────────────
export const apiGetDailyTreasure  = () => apiFetch('/api/treasures/daily')
export const apiClaimDailyTreasure = () => apiFetch('/api/treasures/daily/claim', { method: 'POST' })
export const apiAdminGetStats         = () => apiFetch('/api/admin/stats')
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
export const apiGetAchievements        = ()       => apiFetch('/api/achievements')
export const apiGetDailyAchievements   = ()       => apiFetch('/api/achievements/daily')
export const apiGetDailyQuests         = ()       => apiFetch('/api/quests/daily')
export const apiForgeCard              = (cardId) => apiFetch(`/api/forge/${cardId}`, { method: 'POST' })
export const apiForgeShiny             = (cardId) => apiFetch('/api/forge/shiny', { method: 'POST', body: { cardId } })
export const apiGetAdminDailyQuests    = ()       => apiFetch('/api/admin/daily-quests')
export const apiCreateAdminDailyQuest  = (body)   => apiFetch('/api/admin/daily-quests', { method: 'POST', body })
export const apiUpdateAdminDailyQuest  = (id, body) => apiFetch(`/api/admin/daily-quests/${id}`, { method: 'PATCH', body })
export const apiDeleteAdminDailyQuest  = (id)     => apiFetch(`/api/admin/daily-quests/${id}`, { method: 'DELETE' })
export const apiRegenerateDailySchedule = (date)  => apiFetch('/api/admin/daily-quests/schedule/regenerate', { method: 'POST', body: { date } })
export const apiGetDailySchedule       = (date)   => apiFetch(`/api/admin/daily-quests/schedule${date ? '?date=' + date : ''}`)
export const apiGetAchievementDefs     = ()       => apiFetch('/api/admin/achievement-definitions')
export const apiCreateAchievementDef   = (body)   => apiFetch('/api/admin/achievement-definitions', { method: 'POST', body })
export const apiUpdateAchievementDef   = (id, body) => apiFetch(`/api/admin/achievement-definitions/${id}`, { method: 'PATCH', body })
export const apiDeleteAchievementDef   = (id)     => apiFetch(`/api/admin/achievement-definitions/${id}`, { method: 'DELETE' })
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
export const apiGetDocsPage   = (page)          => apiFetch(`/api/docs/${page}`)
export const apiSaveDocsPage  = (page, content) => apiFetch(`/api/docs/${page}`, { method: 'PATCH', body: { content } })

// ─── Saisons ──────────────────────────────────────────────────────────────────
export const apiGetCurrentSeason      = ()         => apiFetch('/api/seasons/current')
export const apiMarkSeasonSeen        = ()         => apiFetch('/api/seasons/current/seen', { method: 'POST' })
export const apiGetAdminSeasons       = ()         => apiFetch('/api/admin/seasons')
export const apiCreateAdminSeason     = (body)     => apiFetch('/api/admin/seasons', { method: 'POST', body })
export const apiUpdateAdminSeason     = (id, body) => apiFetch(`/api/admin/seasons/${id}`, { method: 'PATCH', body })
export const apiDeleteAdminSeason     = (id)       => apiFetch(`/api/admin/seasons/${id}`, { method: 'DELETE' })
