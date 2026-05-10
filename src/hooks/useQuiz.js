import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetCurrentQuiz, apiJoinQuiz, apiAnswerQuiz } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

export function useQuiz({ profile, limits, earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onQuizEnd, cardPool, checkAchievements, onForgePointsEarned }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onQuizEnd, cardPool, checkAchievements, onForgePointsEarned }

  const [nextQuizTime,  setNextQuizTime] = useState(Date.now() + QUIZ_INTERVAL * 1000)
  const [countdown,     setCountdown]    = useState(QUIZ_INTERVAL)
  const [pendingQuiz,   setPendingQuiz]  = useState(null)
  const [activeQuiz,    setActiveQuiz]   = useState(null)
  const [nextCard,      setNextCard]     = useState(null)
  const [history,       setHistory]      = useState([])
  const [quizKey,       setQuizKey]      = useState(0)
  const activeQuizRef   = useRef(null)
  const snoozedUntilRef = useRef(0)
  const pendingQuizRef  = useRef(null)
  const nextQuizTimeRef = useRef(nextQuizTime)
  const isFetchingRef   = useRef(false)
  const joinedQuizzesRef = useRef(new Set())

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
    const refTime = solvedAt || Date.now()
    setNextQuizTime(refTime + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000)
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
        // Nouvelle participation : incrément de l'or ET animation
        cbRef.current.earnGoldWithFx(1)
      } else {
        // Déjà participé localement : on déclenche juste l'animation pour l'UX sans incrémenter le solde
        if (cbRef.current.showGoldFlash) cbRef.current.showGoldFlash(1)
      }

      apiJoinQuiz(quiz.id).then(({ data }) => {
        // Si le backend refuse finalement l'or (limite atteinte) et que c'était une nouvelle participation
        if (data && data.gold_earned === 0 && data.already_joined === false) {
          cbRef.current.showToast(cbRef.current.t('toast_gold_limit'), 'error')
        }
      }).catch(() => {})
    }
  }, [pendingQuiz, profile])

  const handleSkip = useCallback((snoozeMs = 0) => {
    if (!pendingQuiz) return
    setHistory(h => [{ card: pendingQuiz.card, winner: '—', won: false, skipped: true }, ...h].slice(0, 10))
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
      setHistory(h => [{ card, winner: 'Moi', won: true }, ...h].slice(0, 10))
      if (data.card_earned) {
        showToast(t('toast_quiz_won').replace('{card}', card.name))
      } else {
        showToast(t('toast_quiz_limit'), 'error')
      }
      const solvedAt = Date.now()
      setTimeout(() => advanceQuiz(solvedAt), 2200)
      return true
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
    const nextTime = solvedAt + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000

    if (!activeQuizRef.current) {
      // Si le joueur n'a pas rejoint mais que la popup est ouverte
      const pending = pendingQuizRef.current
      if (pending) {
        // Révéler le gagnant dans la notification avant de fermer
        // (l'historique est géré côté quiz:solved pour éviter les doublons)
        setPendingQuiz(p => p ? { ...p, winner: npc } : null)
        setTimeout(() => {
          setPendingQuiz(currentPending => {
            if (currentPending && currentPending.id === pending.id) {
              setNextQuizTime(nextTime)
              return null
            }
            return currentPending
          })
        }, 5000)
      } else {
        // Joueur ayant passé le geocoin ou naviguant : resync du timer en arrière-plan
        setNextQuizTime(nextTime)
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
    pendingQuiz, setPendingQuiz,
    activeQuiz, setActiveQuiz,
    nextCard, setNextCard,
    history, setHistory,
    quizKey, setQuizKey,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz,
    handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz,
  }
}
