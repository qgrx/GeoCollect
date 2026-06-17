import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetCurrentQuiz, apiJoinQuiz, apiAnswerQuiz } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

export function useQuiz({ profile, limits, earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onQuizEnd, cardPool, checkAchievements, onForgePointsEarned }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onQuizEnd, cardPool, checkAchievements, onForgePointsEarned, limits }

  const [nextQuizTime,  setNextQuizTime] = useState(Date.now() + QUIZ_INTERVAL * 1000)
  const [countdown,     setCountdown]    = useState(QUIZ_INTERVAL)
  const [pendingQuiz,   setPendingQuiz]  = useState(null)
  const [activeQuiz,    setActiveQuiz]   = useState(null)
  const [nextCard,      setNextCard]     = useState(null)
  const [nextQuizRarity,setNextQuizRarity]=useState(null)
  const [holdOffer,     setHoldOffer]    = useState(null)
  const [history,       setHistory]      = useState([])
  const [lostToWinner,  setLostToWinner] = useState(null)
  const [quizKey,       setQuizKey]      = useState(0)
  // Durée du cycle (s) pour la barre de progression — suit l'intervalle dynamique serveur
  const [cycleSec,      setCycleSec]     = useState(limits?.quizInterval ?? QUIZ_INTERVAL)
  const activeQuizRef   = useRef(null)
  const snoozedUntilRef = useRef(0)
  const pendingQuizRef  = useRef(null)
  const nextQuizTimeRef = useRef(nextQuizTime)
  const isFetchingRef   = useRef(false)
  const joinedQuizzesRef = useRef(new Set())
  // Horaire exact du prochain quiz fourni par le serveur (next_quiz_at, ms) et
  // dernier intervalle dynamique connu (s) — font autorité sur le calcul local.
  const serverNextQuizAtRef = useRef(0)
  const dynIntervalRef      = useRef(null)

  // Appliqué par les events socket (quiz:solved / quiz:expired) : enregistre
  // l'horaire et l'intervalle réels du serveur, qui priment sur quizInterval.
  const applyServerSchedule = useCallback((nextAtMs, intervalSec) => {
    serverNextQuizAtRef.current = nextAtMs
    if (intervalSec && intervalSec > 0) {
      dynIntervalRef.current = intervalSec
      setCycleSec(intervalSec)
    }
    setNextQuizTime(nextAtMs)
  }, [])

  // Prochain horaire : privilégie l'horaire serveur (si encore à venir), sinon
  // repli sur le dernier intervalle dynamique connu, puis quizInterval.
  function resolveNextQuizTime(solvedAt) {
    const s = serverNextQuizAtRef.current
    if (s && s > Date.now() + 1500) return s
    const sec = dynIntervalRef.current ?? limits?.quizInterval ?? QUIZ_INTERVAL
    return (solvedAt || Date.now()) + sec * 1000
  }

  useEffect(() => { nextQuizTimeRef.current = nextQuizTime }, [nextQuizTime])

  useEffect(() => { pendingQuizRef.current = pendingQuiz }, [pendingQuiz])

  // Countdown — synchronisé sur l'horloge système (évite la désynchronisation)
  useEffect(() => {
    if (activeQuiz || pendingQuiz) return
    const update = () => {
      let rem = Math.ceil((nextQuizTime - Date.now()) / 1000)
      if (rem <= 0) {
        if (!profile) {
          // Mode invité sans socket : on simule le cycle en boucle
          setNextQuizTime(Date.now() + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000)
          rem = limits?.quizInterval ?? QUIZ_INTERVAL
        } else if (!isFetchingRef.current) {
          // Utilisateur connecté : on interroge l'API pour récupérer le quiz prêt
          isFetchingRef.current = true
          apiGetCurrentQuiz().then(({ data }) => {
            if (data?.quiz) {
              const wc = data.quiz.answer_word_count || 1
              const poolCard = cbRef.current.cardPool?.find(c => c.id === data.quiz.card?.id) || {}
              const curLang = getLang()
              const trans = data.quiz.translations?.[curLang]
              const card = { ...data.quiz.card, ...poolCard, sellable: true, minPrice: null, desc: '' }
              setPendingQuiz({
                ...data.quiz,
                id:   data.quiz.id,
                q:    trans?.question || data.quiz.question,
                a:    trans?.answer ? Array((trans.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
                h:    data.quiz.hint,
                card,
              })
              setNextCard(card)
              isFetchingRef.current = false
            } else {
              if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)
              setTimeout(() => { isFetchingRef.current = false }, 2000)
            }
          }).catch(() => {
            setTimeout(() => { isFetchingRef.current = false }, 2000)
          })
        }
      }
      setCountdown(Math.max(0, rem))
    }
    update()
    const timer = setInterval(update, 500)
    return () => clearInterval(timer)
  }, [nextQuizTime, activeQuiz, pendingQuiz, profile, limits])

  function advanceQuiz(solvedAt) {
    cbRef.current.onQuizEnd?.();
    setNextQuizTime(resolveNextQuizTime(solvedAt))
    setActiveQuiz(null)
    activeQuizRef.current = null
  }

  const handleJoin = useCallback(async () => {
    let quiz = pendingQuiz
    if (quiz && quiz.winner) return // Ne pas rejoindre si déjà gagné
    if (!quiz) {
      const { data } = await apiGetCurrentQuiz()
      if (!data?.quiz) return
      const wc = data.quiz.answer_word_count || 1
      const poolCard = cbRef.current.cardPool?.find(c => c.id === data.quiz.card?.id) || {}
      const curLang2 = getLang()
      const trans2 = data.quiz.translations?.[curLang2]
      quiz = {
        ...data.quiz,
        id:   data.quiz.id,
        q:    trans2?.question || data.quiz.question,
        a:    trans2?.answer ? Array((trans2.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
        h:    data.quiz.hint,
        card: { ...data.quiz.card, ...poolCard, sellable: true, minPrice: null, desc: '' },
      }
    }
    if (!quiz) return
    setActiveQuiz(quiz)
    activeQuizRef.current = quiz
    setPendingQuiz(null)
    if (profile && quiz.id) {
      if (!joinedQuizzesRef.current.has(quiz.id)) {
        joinedQuizzesRef.current.add(quiz.id)
        const joinGold = cbRef.current.limits?.quizJoinGold ?? 1
        if (joinGold > 0) cbRef.current.earnGoldWithFx(joinGold)
      } else {
        const joinGold = cbRef.current.limits?.quizJoinGold ?? 1
        if (joinGold > 0 && cbRef.current.showGoldFlash) cbRef.current.showGoldFlash(joinGold)
      }

      apiJoinQuiz(quiz.id).then(({ data }) => {
        // Si le backend refuse finalement l'or (limite atteinte) et que c'était une nouvelle participation
        // (uniquement si l'or de participation est activé — sinon gold_earned=0 est normal)
        const joinGold = cbRef.current.limits?.quizJoinGold ?? 1
        if (joinGold > 0 && data && data.gold_earned === 0 && data.already_joined === false) {
          cbRef.current.showToast(cbRef.current.t('toast_gold_limit'), 'error')
        }
      }).catch(() => {})
    }
  }, [pendingQuiz, profile])

  const handleSkip = useCallback((snoozeMs = 0) => {
    if (!pendingQuiz) return
    setHistory(h => [{ card: pendingQuiz.card, winner: '—', won: false, skipped: true, isShiny: false }, ...h].slice(0, 10))
    // Relancer le compteur en arrière-plan
    setNextQuizTime(Date.now() + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000)
    setPendingQuiz(null)
    if (snoozeMs > 0) snoozedUntilRef.current = Date.now() + snoozeMs
  }, [pendingQuiz, limits])

  const handleQuizAnswer = useCallback(async (userAnswer) => {
    const card = activeQuiz.card
    const { earnCard, earnGoldWithFx, showToast, t } = cbRef.current
    if (profile && activeQuiz.id) {
      const { data, error, status } = await apiAnswerQuiz(activeQuiz.id, userAnswer)
      if (error) {
        if (status === 429) return 'fast'    // trop rapide
        if (status === 409) return 'late'    // quelqu'un d'autre a gagné en même temps
        if (status === 404) return 'late'    // quiz expiré avant la soumission
        return false                          // mauvaise réponse (422)
      }
      if (data.card_earned) {
        earnCard(card, data.is_shiny || false)
      }
      if (data.achievements?.length) {
        cbRef.current.checkAchievements?.(data.achievements)
      }
      // Toujours notifier l'activité quête (même si forge_points = 0, la progression change)
      cbRef.current.onForgePointsEarned?.(data.forge_points_earned || 0)
      if (data.gold_earned) earnGoldWithFx(data.gold_earned)
      if (data.streak != null) cbRef.current.onStreakUpdate?.(data.streak)
      setHistory(h => [{ card, winner: 'Moi', won: true, isShiny: data.is_shiny || false }, ...h].slice(0, 10))

      // Déterminer l'issue pour piloter le visuel de résultat de la modale
      let outcome = 'card'
      let forge = 0
      if (data.card_earned) {
        outcome = 'card'
        showToast(t('toast_quiz_won').replace('{card}', card.name))
      } else if (data.hold_eligible) {
        // Carte précieuse hors-limite : le joueur choisit (dépôt OU 1 PF) dans la HoldModal.
        // On ne crédite rien ici — le choix s'en charge.
        outcome = 'hold'
        setHoldOffer(data.hold_card)
      } else {
        // Consolation simple (commun/rare hors-limite) : conversion automatique en PF.
        outcome = 'consolation'
        forge = data.consolation_forge ?? 0
        if (forge > 0) cbRef.current.onForgePointsEarned?.(forge)
      }

      const solvedAt = Date.now()
      setTimeout(() => advanceQuiz(solvedAt), outcome === 'hold' ? 600 : 2200)
      return { ok: true, outcome, forge, forgeCapped: !!data.forge_capped, card }
    }
    return false
  }, [activeQuiz, profile])

  const handleCloseActiveQuiz = useCallback(() => {
    if (activeQuizRef.current) {
      setPendingQuiz(activeQuizRef.current)
      setActiveQuiz(null)
      activeQuizRef.current = null
    }
  }, [])

  const handleQuizExpire = useCallback((npc, isBot = false) => {
    const solvedAt = Date.now()

    if (!activeQuizRef.current) {
      const pending = pendingQuizRef.current
      if (pending) {
        setLostToWinner(npc)
        setTimeout(() => {
          setLostToWinner(null)
          setPendingQuiz(currentPending => {
            if (currentPending && currentPending.id === pending.id) {
              setNextQuizTime(resolveNextQuizTime(solvedAt))
              return null
            }
            return currentPending
          })
        }, 8000)
      } else {
        setNextQuizTime(resolveNextQuizTime(solvedAt))
      }
      return
    }
    // N'ajouter que si quelqu'un a vraiment gagné (npc = nom du gagnant)
    if (npc) {
      // Histoire gérée par quiz:solved — ici on met juste à jour l'UI de la modale active
      setActiveQuiz(q => q ? { ...q, winner: npc } : null)
    }
    setTimeout(() => advanceQuiz(solvedAt), 5000)
  }, [limits])

  return {
    countdown, setNextQuizTime,
    cycleSec, applyServerSchedule,
    pendingQuiz, setPendingQuiz,
    activeQuiz, setActiveQuiz,
    nextCard, setNextCard,
    nextQuizRarity, setNextQuizRarity,
    holdOffer, setHoldOffer,
    history, setHistory,
    quizKey, setQuizKey,
    lostToWinner, setLostToWinner,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz,
    handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz,
  }
}
