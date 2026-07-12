import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetBeginnerQuiz, apiAnswerBeginnerQuiz, apiGetBeginnerHistory } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

/**
 * Hook du MODE DÉBUTANT.
 *
 * Cycle : manche 'active' (décompte) → 'recap' (pause de félicitations) → manche.
 * Le timing fait autorité côté serveur (ends_at / next_at + server_time fournis) :
 * on recale localement (endTime / recap.untilMs) en neutralisant le décalage
 * d'horloge client. Une resynchronisation périodique via /current répare les
 * éventuels events socket manqués (sinon le client pouvait rester sans geocoin).
 */
export function useBeginnerQuiz({ profile, active, earnGoldWithFx, earnCard, showToast, t, cardPool, checkAchievements, checkAchievementUpgrades, refreshProfile }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, t, cardPool, checkAchievements, checkAchievementUpgrades, refreshProfile }
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

  const [cycleSec,    setCycleSec]    = useState(QUIZ_INTERVAL)
  const [countdown,   setCountdown]   = useState(0)
  const [endTime,     setEndTime]     = useState(0)        // fin de la manche en cours (ms)
  const [pendingQuiz, setPendingQuiz] = useState(null)
  const [activeQuiz,  setActiveQuiz]  = useState(null)
  const [nextCard,    setNextCard]    = useState(null)
  const [history,     setHistory]     = useState([])
  const [alreadyWon,  setAlreadyWon]  = useState(false)
  const [recap,       setRecap]       = useState(null)     // { winners:[], untilMs }
  const [recapLeft,   setRecapLeft]   = useState(0)
  const [roundStartedAt, setRoundStartedAt] = useState(null)  // started_at SERVEUR (protection inter-modes)
  const activeQuizRef = useRef(null)
  // Refs pour le re-sync (éviter de recréer l'intervalle à chaque tick)
  const recapRef = useRef(null);   useEffect(() => { recapRef.current = recap }, [recap])
  const pendingRef = useRef(null); useEffect(() => { pendingRef.current = pendingQuiz }, [pendingQuiz])
  const endRef = useRef(0);        useEffect(() => { endRef.current = endTime }, [endTime])
  const nextCardRef = useRef(null); useEffect(() => { nextCardRef.current = nextCard }, [nextCard])
  const lastClosedIdRef = useRef(null)   // anti-doublon du feed optimiste

  // Construit l'objet quiz. started_at est dérivé de endTime pour que le décompte
  // de la MODALE (durée - elapsed) coïncide exactement avec celui de la barre.
  const buildQuiz = useCallback((data, fromSocket, startedAtIso) => {
    const cardSrc = data.card
    const poolCard = cbRef.current.cardPool?.find(c => c.id === cardSrc?.id) || {}
    const wc = data.answer_word_count || 1
    const trans = data.translations?.[getLang()]
    const card = { ...cardSrc, ...poolCard, sellable: true, minPrice: null, desc: '' }
    return {
      id:   fromSocket ? data.quiz_id : data.id,
      card,
      q:    trans?.question || data.question,
      a:    trans?.answer ? Array((trans.answer.trim().split(/\s+/).length) || 1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
      is_shiny: false,
      started_at: startedAtIso || data.started_at,
      question_id: data.question_id,
      answer_word_count: wc,
      answer_length: data.answer_length,
    }
  }, [])

  const refreshHistory = useCallback(() => {
    if (!activeRef.current) return
    apiGetBeginnerHistory(10).then(({ data }) => {
      if (data?.history) setHistory(data.history)
    }).catch(() => {})
  }, [])

  // Applique une manche active (depuis socket beginner:new ou /current)
  const applyRound = useCallback((src, fromSocket, alreadyWonFlag) => {
    const dur = src.duration || QUIZ_INTERVAL
    const round = fromSocket ? src : src.quiz
    const serverTime = src.server_time
    const remaining = (round.ends_at && serverTime)
      ? new Date(round.ends_at).getTime() - new Date(serverTime).getTime()
      : dur * 1000
    const end = Date.now() + Math.max(0, remaining)
    setCycleSec(dur)
    setEndTime(end)
    setRecap(null)
    setRoundStartedAt(round.started_at || null)
    setAlreadyWon(!!alreadyWonFlag)
    setActiveQuiz(null); activeQuizRef.current = null
    const startedIso = new Date(end - dur * 1000).toISOString()
    const q = buildQuiz(round, fromSocket, startedIso)
    setNextCard(q.card)
    setPendingQuiz(alreadyWonFlag ? null : q)
  }, [buildQuiz])

  const applyRecap = useCallback((winners, nextAtIso, serverTime, answer, translations) => {
    const until = (nextAtIso && serverTime)
      ? Date.now() + Math.max(0, new Date(nextAtIso).getTime() - new Date(serverTime).getTime())
      : Date.now() + 10_000
    // Réponse révélée dans le récap (mode Entraînement) — traduite si dispo.
    const revealAnswer = translations?.[getLang()]?.answer || answer || null
    setRecap({ winners: winners || [], untilMs: until, answer: revealAnswer })
    setPendingQuiz(null)
    setActiveQuiz(null); activeQuizRef.current = null
    setEndTime(0)
  }, [])

  // Resynchronisation à partir de /current (état serveur faisant autorité)
  const syncFromCurrent = useCallback((data) => {
    if (!data) return
    setCycleSec(data.duration || QUIZ_INTERVAL)
    if (data.phase === 'pause' || (data.quiz == null && data.next_at)) {
      applyRecap(data.winners, data.next_at, data.server_time, data.answer, data.translations)
      refreshHistory()   // resync : couvre un beginner:closed manqué
      return
    }
    if (data.quiz) {
      applyRound(data, false, data.quiz.already_won)
      return
    }
    // idle (transition courte) : on ne casse pas un récap en cours
    if (!recapRef.current || recapRef.current.untilMs <= Date.now()) {
      setPendingQuiz(null); setRecap(null); setEndTime(0)
    }
  }, [applyRound, applyRecap, refreshHistory])

  // Chargement initial à l'activation du mode.
  // Dépend de profile?.id (PAS de l'objet profile) : sinon un rafraîchissement de
  // token Supabase (déclenché au retour d'onglet) recharge et fermerait la modale.
  useEffect(() => {
    if (!active || !profile?.id) return
    let cancelled = false
    apiGetBeginnerQuiz().then(({ data }) => { if (!cancelled) syncFromCurrent(data) }).catch(() => {})
    refreshHistory()
    return () => { cancelled = true }
  }, [active, profile?.id, syncFromCurrent, refreshHistory])

  // Décomptes (manche + récap)
  useEffect(() => {
    if (!active) return
    const tick = () => {
      setCountdown(endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : 0)
      setRecapLeft(recap ? Math.max(0, Math.ceil((recap.untilMs - Date.now()) / 1000)) : 0)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [active, endTime, recap])

  // Re-sync périodique : répare un event manqué (aucune manche dispo / récap fini).
  useEffect(() => {
    if (!active || !profile?.id) return
    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      if (activeQuizRef.current) return                                   // modale ouverte
      if (recapRef.current && recapRef.current.untilMs > Date.now()) return // récap en cours
      if (pendingRef.current && endRef.current > Date.now()) return        // manche dispo
      apiGetBeginnerQuiz().then(({ data }) => { if (!cancelled) syncFromCurrent(data) }).catch(() => {})
    }, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [active, profile?.id, syncFromCurrent])

  // ── Appliqué depuis les handlers socket de App.jsx ──────────────────────────
  const applyBeginnerNew = useCallback((data) => {
    applyRound(data, true, false)
  }, [applyRound])

  const applyBeginnerClosed = useCallback((data) => {
    if (data?.enabled === false) {
      setRecap(null); setPendingQuiz(null); setActiveQuiz(null); activeQuizRef.current = null; setEndTime(0)
      return
    }
    // Mise à jour OPTIMISTE du feed (zéro latence) : la carte de la manche qui vient
    // de se terminer est encore dans nextCardRef, et les gagnants sont fournis par
    // l'event. refreshHistory() ci-dessous réconcilie ensuite avec le serveur.
    const card = nextCardRef.current
    const winners = data?.winners || []
    // Ne pas afficher les manches sans gagnant dans le feed « disputés ».
    if (card && winners.length > 0 && data?.quiz_id != null && lastClosedIdRef.current !== data.quiz_id) {
      lastClosedIdRef.current = data.quiz_id
      setHistory(h => [{ card, winners, winners_count: winners.length, isShiny: false }, ...h].slice(0, 10))
    }
    applyRecap(data?.winners, data?.next_at, data?.server_time, data?.answer, data?.translations)
    refreshHistory()
  }, [applyRecap, refreshHistory])

  // Bascule sur la manche en attente (ouvre la modale)
  const handleJoin = useCallback(() => {
    if (alreadyWon) return
    setPendingQuiz(p => {
      if (!p) return p
      setActiveQuiz(p); activeQuizRef.current = p
      return null
    })
  }, [alreadyWon])

  const handleClose = useCallback(() => {
    if (activeQuizRef.current && !alreadyWon && endRef.current > Date.now()) {
      // Manche encore en cours → on remet en attente. Sinon (terminée) on referme.
      setPendingQuiz(activeQuizRef.current)
    }
    setActiveQuiz(null); activeQuizRef.current = null
  }, [alreadyWon])

  const handleAnswer = useCallback(async (userAnswer) => {
    const aq = activeQuizRef.current
    if (!aq) return 'error'
    const card = aq.card
    const { earnCard, earnGoldWithFx, showToast, t } = cbRef.current
    const { data, error, status } = await apiAnswerBeginnerQuiz(aq.id, userAnswer)
    if (error) {
      if (status === 429) return 'fast'
      if (status === 423) { cbRef.current.refreshProfile?.(); return 'blocked' }  // protection inter-modes
      if (status === 409) return 'late'   // manche terminée
      if (status === 422) return false    // mauvaise réponse
      return 'error'
    }
    setAlreadyWon(true)
    const autoClose = () => setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, 2500)
    if (data.already_won) { autoClose(); return { ok: true, outcome: 'card', card } }
    if (data.card_earned) earnCard(card, false)
    if (data.gold_earned) earnGoldWithFx(data.gold_earned)
    if (data.achievements?.length) cbRef.current.checkAchievements?.(data.achievements)
    if (data.achievement_upgrades?.length) cbRef.current.checkAchievementUpgrades?.(data.achievement_upgrades)
    cbRef.current.refreshProfile?.()   // MAJ last_geocoin_* (protection inter-modes)
    showToast(data.card_earned
      ? t('toast_quiz_won').replace('{card}', card.name)
      : (t('toast_gold_limit') || t('quiz_limit_reached')))
    autoClose()
    return { ok: true, outcome: data.card_earned ? 'card' : 'consolation', card }
  }, [])

  // handleAnswer renvoie aussi 'blocked' si le serveur refuse (423 cross_mode_blocked)

  return {
    cycleSec, countdown,
    pendingQuiz, setPendingQuiz,
    activeQuiz, setActiveQuiz,
    nextCard, history, alreadyWon,
    recap, recapLeft, roundStartedAt,
    activeQuizRef,
    applyBeginnerNew, applyBeginnerClosed, refreshHistory,
    handleJoin, handleClose, handleAnswer,
  }
}
