import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetCurrentQuiz, apiJoinQuiz, apiAnswerQuiz } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

export function useQuiz({ profile, isDemo, limits, earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onStreakLeader, onQuizEnd, cardPool, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, onGoldSync }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, showGoldFlash, t, onStreakUpdate, onStreakLeader, onQuizEnd, cardPool, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, onGoldSync, limits }

  const [nextQuizTime,  setNextQuizTime] = useState(Date.now() + QUIZ_INTERVAL * 1000)
  const [countdown,     setCountdown]    = useState(QUIZ_INTERVAL)
  const [pendingQuiz,   setPendingQuiz]  = useState(null)
  const [activeQuiz,    setActiveQuiz]   = useState(null)
  const [nextCard,      setNextCard]     = useState(null)
  const [nextQuizRarity,setNextQuizRarity]=useState(null)
  const [holdOffer,     setHoldOffer]    = useState(null)
  const [history,       setHistory]      = useState([])
  const [lostToWinner,  setLostToWinner] = useState(null)
  const [lostToGlory,   setLostToGlory]  = useState(false)
  const [quizKey,       setQuizKey]      = useState(0)
  // Durée du cycle (s) pour la barre de progression — suit l'intervalle dynamique serveur
  const [cycleSec,      setCycleSec]     = useState(limits?.quizInterval ?? QUIZ_INTERVAL)
  const activeQuizRef   = useRef(null)
  const snoozedUntilRef = useRef(0)
  const pendingQuizRef  = useRef(null)
  const nextQuizTimeRef = useRef(nextQuizTime)
  const isFetchingRef   = useRef(false)
  const joinedQuizzesRef = useRef(new Set())
  // Quiz déjà résolus (gagné / perdu / 409) : fermer la modale ne doit PAS les
  // remettre en attente (sinon on re-propose un quiz déjà gagné → re-réponse → 409).
  const resolvedQuizIdsRef = useRef(new Set())
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
        if (isDemo) {
          // Démo : aucun quiz global. On ne fetch rien (le contrôleur démo pilote
          // pendingQuiz/activeQuiz) — sinon le compte invité verrait les vrais geocoins.
          rem = 0
        } else if (!profile) {
          // Mode invité sans socket : on simule le cycle en boucle
          setNextQuizTime(Date.now() + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000)
          rem = limits?.quizInterval ?? QUIZ_INTERVAL
        } else if (!isFetchingRef.current) {
          // Utilisateur connecté : on interroge l'API pour récupérer le quiz prêt
          isFetchingRef.current = true
          apiGetCurrentQuiz().then(({ data }) => {
            if (data) cbRef.current.onStreakLeader?.(data.streak_leader ?? null)
            if (data?.quiz) {
              if (resolvedQuizIdsRef.current.has(data.quiz.id)) { isFetchingRef.current = false; return }
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
  }, [nextQuizTime, activeQuiz, pendingQuiz, profile, isDemo, limits])

  function advanceQuiz(solvedAt) {
    cbRef.current.onQuizEnd?.();
    setNextQuizTime(resolveNextQuizTime(solvedAt))
    setActiveQuiz(null)
    activeQuizRef.current = null
  }

  const handleJoin = useCallback(async () => {
    let quiz = pendingQuiz
    if (quiz && quiz.winner) return // Ne pas rejoindre si déjà gagné
    if (!quiz && isDemo) return     // démo : aucun quiz global à récupérer
    if (!quiz) {
      const { data } = await apiGetCurrentQuiz()
      if (!data?.quiz) return
      // Propager le joueur en série : sans ça, en rejoignant via /current (rechargement,
      // participation tardive, event quiz:new manqué) le leader n'aurait pas son statut
      // « en feu » → masquage/blocage absents → la pénalité ne s'applique pas côté UI.
      cbRef.current.onStreakLeader?.(data.streak_leader ?? null)
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

      apiJoinQuiz(quiz.id).then(({ data, status }) => {
        // Quiz déjà résolu / expiré (event quiz:solved manqué, ex. socket coupé sur
        // mobile) : le /join renvoie 404 → on referme et on nettoie plutôt que de
        // laisser le joueur répondre à un quiz déjà gagné par un autre.
        if (status === 404) {
          resolvedQuizIdsRef.current.add(quiz.id)
          if (activeQuizRef.current?.id === quiz.id) { setActiveQuiz(null); activeQuizRef.current = null }
          setPendingQuiz(p => (p && p.id === quiz.id ? null : p))
          setNextQuizTime(resolveNextQuizTime(Date.now()))
          cbRef.current.showToast?.(cbRef.current.t('quiz_already_solved'), 'error')
          return
        }
        // Si le backend refuse finalement l'or (limite atteinte) et que c'était une nouvelle participation
        // (uniquement si l'or de participation est activé — sinon gold_earned=0 est normal)
        const joinGold = cbRef.current.limits?.quizJoinGold ?? 1
        if (joinGold > 0 && data && data.gold_earned === 0 && data.already_joined === false) {
          cbRef.current.showToast(cbRef.current.t('toast_gold_limit'), 'error')
        }
      }).catch(() => {})
    }
  }, [pendingQuiz, profile, isDemo])

  const handleSkip = useCallback((snoozeMs = 0) => {
    if (!pendingQuiz) return
    setHistory(h => [{ card: pendingQuiz.card, winner: '—', won: false, skipped: true, isShiny: false }, ...h].slice(0, 10))
    // Relancer le compteur en arrière-plan
    setNextQuizTime(Date.now() + (limits?.quizInterval ?? QUIZ_INTERVAL) * 1000)
    setPendingQuiz(null)
    if (snoozeMs > 0) snoozedUntilRef.current = Date.now() + snoozeMs
  }, [pendingQuiz, limits])

  const handleQuizAnswer = useCallback(async (userAnswer, choice) => {
    if (!activeQuiz) return 'error'  // fenêtre fermée entre-temps (ex. revalidation tardive)
    const card = activeQuiz.card
    const { earnCard, earnGoldWithFx, showToast, t } = cbRef.current
    if (profile && activeQuiz.id) {
      // Honeypot anti-bot : on renvoie le nonce émis par /current (présent via ...data.quiz).
      const { data, error, status, body } = await apiAnswerQuiz(activeQuiz.id, userAnswer, activeQuiz.nonce, choice)
      if (error) {
        if (status === 425) return { handicap: true, wait_ms: body?.wait_ms || 0 } // série : délai cadeau
        if (status === 423) return 'blocked' // protection inter-modes (prochaine manche)
        if (status === 429) return 'fast'    // trop rapide
        if (status === 409 || status === 404) { resolvedQuizIdsRef.current.add(activeQuiz.id); return 'late' }  // déjà résolu / expiré
        if (status === 422) return false     // vraie mauvaise réponse
        return 'error'                        // réseau / 5xx / inconnu : la réponse a pu aboutir serveur
      }
      // Victoire « pour la gloire » — toutes limites atteintes : le quiz reste actif
      // pour les autres joueurs. On ferme la modale avec un résultat spécial,
      // SANS avancer le cycle (quiz toujours en cours). Le quiz:solved des autres
      // déclenchera le prochain quiz via handleQuizExpire.
      if (data.glory) {
        resolvedQuizIdsRef.current.add(activeQuiz.id)
        if (data.achievements?.length) cbRef.current.checkAchievements?.(data.achievements)
        if (data.achievement_upgrades?.length) cbRef.current.checkAchievementUpgrades?.(data.achievement_upgrades)
        // Gloire : pas de geocoin, mais on crédite les consolations cumulées (or + PF).
        if (data.gold_earned) earnGoldWithFx(data.gold_earned)
        cbRef.current.onForgePointsEarned?.(data.forge_points_earned || 0)
        // Choix « dépôt » refusé par le serveur (plein / or insuffisant) → gloire quand même.
        showToast(data.hold_declined === 'full'              ? (t('toast_deposit_declined_full') || '🗄️ Dépôt plein — victoire pour la gloire !')
                : data.hold_declined === 'insufficient_gold' ? (t('toast_deposit_declined_gold') || '💰 Or insuffisant pour le dépôt — victoire pour la gloire !')
                : data.hold ? (t('toast_deposit_win') || '📥 Geocoin mis au dépôt !') : t('toast_glory_win'))
        // Fenêtre de grâce « les autres ont N s pour répondre » : on pose la deadline sur le
        // quiz (pour le décompte affiché dans la modale) et on garde la modale ouverte jusqu'à
        // sa fin (au lieu d'un délai fixe), corrigée du décalage d'horloge serveur/client.
        const graceDeadline = (data.grace_until && data.server_time)
          ? Date.now() + Math.max(0, new Date(data.grace_until).getTime() - new Date(data.server_time).getTime())
          : null
        if (graceDeadline) {
          setActiveQuiz(q => q ? { ...q, graceDeadline } : q)
          if (activeQuizRef.current) activeQuizRef.current = { ...activeQuizRef.current, graceDeadline }
        }
        const closeIn = graceDeadline ? Math.max(2000, graceDeadline - Date.now() + 1200) : 3500
        setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, closeIn)
        return { ok: true, outcome: 'glory', forge: data.forge_points_earned || 0 }
      }

      // Dépôt (geocoin précieux déjà possédé, hors-limite) : il consomme désormais un VRAI
      // prix (comme un gain réel) et met un exemplaire au dépôt — pas d'ajout collection ni
      // d'or, pas d'entrée « gagné par moi » perso (l'entrée du round est bâtie au quiz:solved).
      // final=false ⇒ round multi non terminé : je referme sans avancer le cycle.
      if (data.deposited) {
        resolvedQuizIdsRef.current.add(activeQuiz.id)
        // Location payée à la volée : synchroniser le solde renvoyé et l'afficher dans le toast.
        if (typeof data.gold === 'number') cbRef.current.onGoldSync?.(data.gold)
        showToast(data.hold_price_paid > 0
          ? (t('toast_deposit_win_paid') || '📥 Geocoin mis au dépôt ! (location −{price} G)').replace('{price}', data.hold_price_paid)
          : data.hold ? (t('toast_deposit_win') || '📥 Geocoin mis au dépôt !') : t('toast_quiz_won').replace('{card}', card.name))
        const solvedAt = Date.now()
        if (data.final === false) {
          setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, 900)
        } else {
          setTimeout(() => advanceQuiz(solvedAt), 900)
        }
        return { ok: true, outcome: 'hold', forge: 0 }
      }

      resolvedQuizIdsRef.current.add(activeQuiz.id)  // gagné → ne plus jamais le re-pender

      // Re-tentative après une réponse gagnante dont la réponse HTTP avait été perdue :
      // le serveur confirme que CE joueur a déjà gagné → on referme en « gagné » et on
      // synchronise la collection localement, sans toast/or/quête (déjà fait au 1er essai).
      if (data.already_won) {
        earnCard(card, data.is_shiny || false)
        setHistory(h => h.some(e => e.won && e.card?.id === card.id) ? h
          : [{ card, winner: 'Moi', won: true, isShiny: data.is_shiny || false }, ...h].slice(0, 10))
        setTimeout(() => advanceQuiz(Date.now()), 2200)
        return { ok: true, outcome: 'card', forge: 0 }
      }
      if (data.card_earned) {
        earnCard(card, data.is_shiny || false)
      }
      if (data.achievements?.length) {
        cbRef.current.checkAchievements?.(data.achievements)
      }
      if (data.achievement_upgrades?.length) {
        cbRef.current.checkAchievementUpgrades?.(data.achievement_upgrades)
      }
      // Toujours notifier l'activité quête (même si forge_points = 0, la progression change)
      cbRef.current.onForgePointsEarned?.(data.forge_points_earned || 0)
      if (data.gold_earned) earnGoldWithFx(data.gold_earned)
      if (data.streak != null) cbRef.current.onStreakUpdate?.(data.streak)
      // Inclure d'emblée les joueurs « pour la gloire » (renvoyés par /answer) : sinon
      // l'entrée n'aurait que la coche ✓ et le compteur « (N🏆) » n'apparaîtrait qu'après un
      // rechargement (le patch via quiz:solved peut manquer l'entrée pas encore créée).
      const meGloryWinners = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold }))
      setHistory(h => {
        // quiz:solved peut arriver avant la réponse HTTP (race réseau) et avoir déjà inséré
        // une entrée pour ce round : on la patche plutôt que de prepend un doublon.
        const qid = activeQuiz?.id
        if (qid) {
          const idx = h.findIndex(e => e.quiz_id === qid)
          if (idx >= 0) {
            const updated = { ...h[idx], won: true, glory_winners: meGloryWinners.length ? meGloryWinners : h[idx].glory_winners }
            return [...h.slice(0, idx), updated, ...h.slice(idx + 1)]
          }
        }
        return [{ card, winner: 'Moi', won: true, isShiny: data.is_shiny || false, glory_winners: meGloryWinners, quiz_id: qid }, ...h].slice(0, 10)
      })

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
      if (data.final === false) {
        // Round multi-prix non terminé : je referme MA modale (j'ai déjà mon geocoin) mais
        // je n'avance PAS le cycle global — le prochain quiz est piloté par quiz:solved
        // (quand le dernier prix est pris ou la fenêtre de grâce écoulée).
        setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, outcome === 'hold' ? 600 : 2200)
      } else {
        setTimeout(() => advanceQuiz(solvedAt), outcome === 'hold' ? 600 : 2200)
      }
      return { ok: true, outcome, forge, forgeCapped: !!data.forge_capped, card }
    }
    return false
  }, [activeQuiz, profile])

  const handleCloseActiveQuiz = useCallback(() => {
    if (activeQuizRef.current) {
      // Ne re-mettre en attente QUE si le quiz n'est pas déjà résolu (sinon on
      // re-propose un quiz gagné → re-réponse → « un autre joueur a répondu »).
      if (!resolvedQuizIdsRef.current.has(activeQuizRef.current.id)) {
        setPendingQuiz(activeQuizRef.current)
      }
      setActiveQuiz(null)
      activeQuizRef.current = null
    }
  }, [])

  const handleQuizExpire = useCallback((npc, isBot = false, isGlory = false) => {
    const solvedAt = Date.now()

    if (!activeQuizRef.current) {
      const pending = pendingQuizRef.current
      if (pending) {
        setLostToWinner(npc)
        setLostToGlory(isGlory)
        setTimeout(() => {
          setLostToWinner(null)
          setLostToGlory(false)
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
    // Quiz actif résolu par un autre → marqué résolu (fermer ne le re-pend pas).
    // Si CE joueur avait déjà répondu « pour la gloire » (quiz déjà dans resolvedQuizIds), il a
    // eu son écran de gloire : dès qu'un autre rafle le geocoin pendant le décompte, on ferme
    // vite (1,5 s) au lieu d'attendre la fin de la fenêtre de grâce.
    const wasResolvedByMe = !!activeQuizRef.current?.id && resolvedQuizIdsRef.current.has(activeQuizRef.current.id)
    if (activeQuizRef.current?.id) resolvedQuizIdsRef.current.add(activeQuizRef.current.id)
    // N'ajouter que si quelqu'un a vraiment gagné (npc = nom du gagnant)
    if (npc) {
      // Histoire gérée par quiz:solved — ici on met juste à jour l'UI de la modale active
      setActiveQuiz(q => q ? { ...q, winner: npc } : null)
    }
    setTimeout(() => advanceQuiz(solvedAt), wasResolvedByMe ? 1500 : 5000)
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
    lostToGlory, setLostToGlory,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz,
    handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz,
  }
}
