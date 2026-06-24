import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetBeginnerQuiz, apiAnswerBeginnerQuiz, apiGetBeginnerHistory } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

/**
 * Hook du MODE DÉBUTANT — version allégée de useQuiz, pilotée par les events socket
 * beginner:new / beginner:closed / beginner:answered.
 *
 * Différences clés avec le PVP :
 *   - manche de durée FIXE (duration serveur), geocoins communs, pas de shiny
 *   - PLUSIEURS gagnants : répondre juste → état « gagné », sans « trop tard » ;
 *     la manche continue jusqu'à la fin du décompte (nouveau geocoin ensuite)
 *   - aucun point de forge
 */
export function useBeginnerQuiz({ profile, active, earnGoldWithFx, earnCard, showToast, t, cardPool, checkAchievements }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, t, cardPool, checkAchievements }
  // Les events socket beginner:* arrivent même en mode PVP : on évite alors tout
  // appel réseau (l'historique débutant n'est utile que quand le mode est affiché).
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

  const [cycleSec,    setCycleSec]    = useState(QUIZ_INTERVAL)
  const [countdown,   setCountdown]   = useState(QUIZ_INTERVAL)
  const [endTime,     setEndTime]     = useState(0)        // fin de la manche en cours (ms)
  const [pendingQuiz, setPendingQuiz] = useState(null)
  const [activeQuiz,  setActiveQuiz]  = useState(null)
  const [nextCard,    setNextCard]    = useState(null)
  const [history,     setHistory]     = useState([])
  const [alreadyWon,  setAlreadyWon]  = useState(false)
  const activeQuizRef = useRef(null)

  // Construire un objet quiz à partir d'un payload (socket beginner:new ou /current)
  const buildQuiz = useCallback((data, fromSocket) => {
    const cardSrc = fromSocket ? data.card : data.card
    const poolCard = cbRef.current.cardPool?.find(c => c.id === cardSrc?.id) || {}
    const wc = data.answer_word_count || 1
    const curLang = getLang()
    const trans = data.translations?.[curLang]
    const card = { ...cardSrc, ...poolCard, sellable: true, minPrice: null, desc: '' }
    return {
      id:   fromSocket ? data.quiz_id : data.id,
      card,
      q:    trans?.question || data.question,
      a:    trans?.answer ? Array((trans.answer.trim().split(/\s+/).length) || 1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
      h:    data.hint,
      is_shiny: false,
      started_at: data.started_at,
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

  // Chargement initial à l'activation du mode
  useEffect(() => {
    if (!active || !profile) return
    let cancelled = false
    apiGetBeginnerQuiz().then(({ data }) => {
      if (cancelled || !data) return
      setCycleSec(data.duration || QUIZ_INTERVAL)
      if (data.quiz) {
        const serverNow = data.server_time ? new Date(data.server_time).getTime() : Date.now()
        const startedAt = new Date(data.quiz.started_at).getTime()
        const end = Date.now() + Math.max(0, (data.duration || QUIZ_INTERVAL) * 1000 - (serverNow - startedAt))
        setEndTime(end)
        setAlreadyWon(!!data.quiz.already_won)
        if (!data.quiz.already_won) setPendingQuiz(buildQuiz(data.quiz, false))
        setNextCard(buildQuiz(data.quiz, false).card)
      }
    }).catch(() => {})
    refreshHistory()
    return () => { cancelled = true }
  }, [active, profile, buildQuiz, refreshHistory])

  // Décompte vers la fin de la manche
  useEffect(() => {
    if (!active) return
    const tick = () => setCountdown(endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : cycleSec)
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [active, endTime, cycleSec])

  // Garde-fou : si la manche se termine (décompte à 0) avec la modale encore ouverte
  // sans victoire, on referme après un court délai. Normalement beginner:new referme
  // déjà la modale ; ce filet évite de rester bloqué sur « Trop tard » si la manche
  // suivante tarde. On NE re-propose PAS la manche écoulée (contrairement à handleClose).
  useEffect(() => {
    if (!active || countdown > 0 || alreadyWon || !activeQuizRef.current) return
    const id = setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, 3000)
    return () => clearTimeout(id)
  }, [active, countdown, alreadyWon])

  // ── Appliqué depuis les handlers socket de App.jsx ──────────────────────────
  const applyBeginnerNew = useCallback((data) => {
    setCycleSec(data.duration || QUIZ_INTERVAL)
    const serverNow = data.server_time ? new Date(data.server_time).getTime() : Date.now()
    const startedAt = new Date(data.started_at).getTime()
    const end = Date.now() + Math.max(0, (data.duration || QUIZ_INTERVAL) * 1000 - (serverNow - startedAt))
    setEndTime(end)
    setAlreadyWon(false)
    const q = buildQuiz(data, true)
    setNextCard(q.card)
    setActiveQuiz(null); activeQuizRef.current = null
    setPendingQuiz(q)
  }, [buildQuiz])

  const applyBeginnerClosed = useCallback(() => {
    refreshHistory()
  }, [refreshHistory])

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
    if (activeQuizRef.current && !alreadyWon) {
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
      if (status === 409) return 'late'   // manche terminée
      if (status === 422) return false    // mauvaise réponse
      return 'error'
    }
    setAlreadyWon(true)
    // Refermer la modale après l'animation de résultat (le bar reprend, ✓ Gagné).
    const autoClose = () => setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, 2500)
    if (data.already_won) {
      // Re-tentative après une réponse gagnante : ne rien re-créditer.
      autoClose()
      return { ok: true, outcome: 'card', card }
    }
    if (data.card_earned) earnCard(card, false)
    if (data.gold_earned) earnGoldWithFx(data.gold_earned)
    if (data.achievements?.length) cbRef.current.checkAchievements?.(data.achievements)
    showToast(data.card_earned
      ? t('toast_quiz_won').replace('{card}', card.name)
      : (t('toast_gold_limit') || t('quiz_limit_reached')))
    autoClose()
    return { ok: true, outcome: data.card_earned ? 'card' : 'consolation', card }
  }, [])

  return {
    cycleSec, countdown,
    pendingQuiz, setPendingQuiz,
    activeQuiz, setActiveQuiz,
    nextCard, history, alreadyWon,
    activeQuizRef,
    applyBeginnerNew, applyBeginnerClosed, refreshHistory,
    handleJoin, handleClose, handleAnswer,
  }
}
