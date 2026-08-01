import { useState, useRef, useEffect, useCallback } from 'react'
import { QUIZ_INTERVAL } from '../data/constants.js'
import { apiGetCurrentQuiz, apiJoinQuiz, apiAnswerQuiz } from '../services/api.js'
import { getLang } from '../i18n/translations.js'

// Verrou du poll « quiz prêt ? » relâché d'office passé ce délai : aucune requête
// saine ne dépasse le timeout du client API (cf. services/api.js).
const POLL_LOCK_MAX_MS = 15000

export function useQuiz({ profile, isDemo, limits, earnGoldWithFx, earnCard, showToast, showGoldFlash, showForgeFlash, t, onStreakUpdate, onStreakLeader, onQuizEnd, cardPool, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, onGoldSync, onNextShiny }) {
  const cbRef = useRef({})
  cbRef.current = { earnGoldWithFx, earnCard, showToast, showGoldFlash, showForgeFlash, t, onStreakUpdate, onStreakLeader, onQuizEnd, cardPool, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, onGoldSync, onNextShiny, limits }

  const [nextQuizTime,  setNextQuizTime] = useState(Date.now() + QUIZ_INTERVAL * 1000)
  const [countdown,     setCountdown]    = useState(QUIZ_INTERVAL)
  const [pendingQuiz,   setPendingQuiz]  = useState(null)
  const [activeQuiz,    setActiveQuiz]   = useState(null)
  const [nextCard,      setNextCard]     = useState(null)
  const [nextQuizRarity,setNextQuizRarity]=useState(null)
  const [holdOffer,     setHoldOffer]    = useState(null)
  const [patronageOffer,setPatronageOffer]=useState(null)   // { quiz_id, rarity, card, remaining } — plafond hebdo atteint → don ou gloire
  const [history,       setHistory]      = useState([])
  const [lostToWinner,  setLostToWinner] = useState(null)
  const [lostToGlory,   setLostToGlory]  = useState(false)
  const [lostToAvatar,  setLostToAvatar] = useState(null)   // avatar geocaching du gagnant (→ remplace 🏆)
  const [lostToWinners, setLostToWinners] = useState(null)  // round multi-prix : TOUS les gagnants [{pseudo, avatar}]
  const [lostToFire,    setLostToFire]    = useState(null)  // gagnant UNIQUE en place en feu : { fire_streak } (flammes graduées bannière)
  const [lostToGloryWinners, setLostToGloryWinners] = useState(null) // joueurs « pour la gloire » du round [{pseudo, avatar}] (affichés en petit)
  const [lostToPatronage, setLostToPatronage] = useState(null)       // mécènes du round [{pseudo, avatar, recipient, recipient_avatar}]
  const [quizKey,       setQuizKey]      = useState(0)
  // Durée du cycle (s) pour la barre de progression — suit l'intervalle dynamique serveur
  const [cycleSec,      setCycleSec]     = useState(limits?.quizInterval ?? QUIZ_INTERVAL)
  const activeQuizRef   = useRef(null)
  const snoozedUntilRef = useRef(0)
  const pendingQuizRef  = useRef(null)
  const nextQuizTimeRef = useRef(nextQuizTime)
  const isFetchingRef   = useRef(false)
  // Génération du poll « quiz prêt ? » : seul le poll courant peut relâcher le verrou
  // (une réponse tardive ne doit pas déverrouiller un poll plus récent).
  const pollSeqRef      = useRef(0)
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
  //
  // fullCycle=false pour un recalage EN COURS de cycle (resync /current, reconnexion) :
  // `intervalSec` n'y est qu'un RELIQUAT (le temps restant, souvent quelques secondes).
  // Il peut piloter la barre de progression, mais JAMAIS dynIntervalRef, qui sert de
  // repli « durée d'un cycle complet » à resolveNextQuizTime — sinon le compteur repart
  // pour un cycle fantôme de quelques secondes juste après une réponse.
  const applyServerSchedule = useCallback((nextAtMs, intervalSec, { fullCycle = true } = {}) => {
    serverNextQuizAtRef.current = nextAtMs
    if (intervalSec && intervalSec > 0) {
      if (fullCycle) dynIntervalRef.current = intervalSec
      setCycleSec(intervalSec)
    }
    setNextQuizTime(nextAtMs)
  }, [])

  /**
   * Round encore OUVERT alors que j'en suis déjà sorti (multi-prix : j'ai pris un
   * geocoin, il en reste ; gloire : la fenêtre de grâce court encore). Sans pending
   * ni activeQuiz, le compteur du prochain quiz repart sur l'estimation posée au
   * quiz:new et peut atteindre ses 10 dernières secondes — gros décompte affiché —
   * ALORS QUE le round n'est pas fini : le joueur voit un décompte fantôme, coupé
   * net par le « Félicitations à… » quand le round se clôt enfin.
   *
   * On le repousse donc au-delà de la fenêtre de grâce : le prochain quiz n'est
   * planifié qu'à la CLÔTURE du round (grâce écoulée) + un intervalle. L'horaire
   * réel arrive ensuite avec quiz:solved / quiz:expired.
   */
  function parkCountdownPastGrace(graceDeadline) {
    if (!graceDeadline) return
    const sec = dynIntervalRef.current ?? limits?.quizInterval ?? QUIZ_INTERVAL
    setNextQuizTime(Math.max(nextQuizTimeRef.current, graceDeadline + sec * 1000))
  }

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
          const tick = ++pollSeqRef.current
          const release = (delay) => setTimeout(() => {
            if (pollSeqRef.current === tick) isFetchingRef.current = false
          }, delay)
          // Filet de sécurité : si la promesse ne se règle JAMAIS (requête perdue en vol,
          // rafraîchissement de session bloqué), le verrou serait définitif → plus aucun
          // poll → compteur figé sur « ··· » avec une rareté annoncée périmée jusqu'au
          // rechargement. On le relâche d'office passé POLL_LOCK_MAX_MS.
          release(POLL_LOCK_MAX_MS)
          apiGetCurrentQuiz().then(({ data }) => {
            if (data) cbRef.current.onStreakLeader?.(data.streak_leaders ?? data.streak_leader ?? null)
            if (data?.quiz) {
              // Round déjà gagné (serveur) : on le mémorise localement pour que tous
              // les autres garde-fous (handleJoin, handleCloseActiveQuiz) s'appuient
              // dessus, puis on ne le propose pas.
              if (data.quiz.already_won) resolvedQuizIdsRef.current.add(data.quiz.id)
              // Round déjà résolu par moi : rien à proposer, mais on ne re-poll pas en
              // boucle serrée (le round reste `active` toute la fenêtre de grâce).
              if (resolvedQuizIdsRef.current.has(data.quiz.id)) { release(2000); return }
              const wc = data.quiz.answer_word_count || 1
              const poolCard = cbRef.current.cardPool?.find(c => c.id === data.quiz.card?.id) || {}
              const curLang = getLang()
              const trans = data.quiz.translations?.[curLang]
              const card = { ...data.quiz.card, ...poolCard, sellable: true, minPrice: null, desc: '' }
              setPendingQuiz({
                ...data.quiz,
                // Skew horloge figé À LA RÉCEPTION (cf. QuizModal) : sert au décompte
                // handicap « en feu », qui doit continuer de défiler entre deux
                // ouvertures de la modale.
                client_skew_ms: data.server_time ? Date.now() - new Date(data.server_time).getTime() : 0,
                id:   data.quiz.id,
                q:    trans?.question || data.quiz.question,
                a:    trans?.answer ? Array((trans.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
                card,
              })
              setNextCard(card)
              release(0)
            } else {
              // Teaser du prochain round : le SERVEUR fait autorité, y compris sur l'horaire.
              // Sans ce recalage, un compteur arrivé à zéro trop tôt (quiz:solved manqué,
              // cadence dynamique plus lente que quizInterval, horloge locale) restait bloqué
              // sur « ··· » — et sur une rareté/brillance annoncées périmées, d'où « ce n'est
              // pas la rareté annoncée qui sort » — jusqu'au rechargement de l'app.
              // (data absent = échec réseau : on ne touche à rien, on retentera.)
              if (data) {
                if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)
                cbRef.current.onNextShiny?.(data.next_is_shiny || false)
                const nextAt = data.next_quiz_at ? new Date(data.next_quiz_at).getTime() : 0
                const srvNow = data.server_time  ? new Date(data.server_time).getTime()  : Date.now()
                const msLeft = nextAt ? nextAt - srvNow : 0
                // Recalage EN COURS de cycle : msLeft est un reliquat, pas une durée de
                // cycle → fullCycle:false (cf. applyServerSchedule).
                if (msLeft > 1000) applyServerSchedule(Date.now() + msLeft, Math.round(msLeft / 1000), { fullCycle: false })
              }
              release(2000)
            }
          }).catch(() => {
            release(2000)
          })
        }
      }
      setCountdown(Math.max(0, rem))
    }
    update()
    const timer = setInterval(update, 500)
    return () => clearInterval(timer)
  }, [nextQuizTime, activeQuiz, pendingQuiz, profile, isDemo, limits, applyServerSchedule])

  function advanceQuiz(solvedAt) {
    cbRef.current.onQuizEnd?.();
    setNextQuizTime(resolveNextQuizTime(solvedAt))
    setActiveQuiz(null)
    activeQuizRef.current = null
  }

  const handleJoin = useCallback(async () => {
    let quiz = pendingQuiz
    if (quiz && quiz.winner) return // Ne pas rejoindre si déjà gagné
    if (quiz?.id && resolvedQuizIdsRef.current.has(quiz.id)) return // round déjà remporté/résolu par moi
    if (!quiz && isDemo) return     // démo : aucun quiz global à récupérer
    if (!quiz) {
      const { data } = await apiGetCurrentQuiz()
      if (!data?.quiz) return
      // Geocoin déjà remporté sur ce round (multi-prix encore ouvert pour les autres) :
      // on n'y rentre pas — /answer refuserait de toute façon (already_winner).
      if (data.quiz.already_won) { resolvedQuizIdsRef.current.add(data.quiz.id); return }
      // Propager les joueurs en série : sans ça, en rejoignant via /current (rechargement,
      // participation tardive, event quiz:new manqué) un joueur en feu n'aurait pas son
      // statut → masquage/blocage absents → la pénalité ne s'applique pas côté UI.
      cbRef.current.onStreakLeader?.(data.streak_leaders ?? data.streak_leader ?? null)
      const wc = data.quiz.answer_word_count || 1
      const poolCard = cbRef.current.cardPool?.find(c => c.id === data.quiz.card?.id) || {}
      const curLang2 = getLang()
      const trans2 = data.quiz.translations?.[curLang2]
      quiz = {
        ...data.quiz,
        // Skew horloge figé à la réception (cf. QuizModal / décompte « en feu »).
        client_skew_ms: data.server_time ? Date.now() - new Date(data.server_time).getTime() : 0,
        id:   data.quiz.id,
        q:    trans2?.question || data.quiz.question,
        a:    trans2?.answer ? Array((trans2.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
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

  const handleQuizAnswer = useCallback(async (userAnswer) => {
    if (!activeQuiz) return 'error'  // fenêtre fermée entre-temps (ex. revalidation tardive)
    const card = activeQuiz.card
    const { earnCard, earnGoldWithFx, showToast, t } = cbRef.current
    if (profile && activeQuiz.id) {
      // Honeypot anti-bot : on renvoie le nonce émis par /current (présent via ...data.quiz).
      const { data, error, status, body } = await apiAnswerQuiz(activeQuiz.id, userAnswer, activeQuiz.nonce)
      if (error) {
        if (status === 425) return { handicap: true, wait_ms: body?.wait_ms || 0 } // série : délai cadeau
        if (status === 423) return 'blocked' // protection inter-modes (prochaine manche)
        if (status === 429) {
          // Deux 429 distincts : anti-spam gradué (trop d'essais → pénalité chronométrée
          // et affichée) vs réponse « trop rapide » (< 500 ms après la question).
          if (body?.error === 'too_many_attempts') return { throttled: true, wait_ms: body.retry_after_ms || 0 }
          return 'fast'
        }
        if (status === 409 || status === 404) {
          // Bonne réponse mais round déjà résolu par un autre : le serveur a quand
          // même compté cette bonne réponse pour les quêtes HEBDO (toute bonne
          // réponse PvP) → notifier l'activité quête pour rafraîchir la barre.
          resolvedQuizIdsRef.current.add(activeQuiz.id)
          cbRef.current.onForgePointsEarned?.(0)
          return 'late'
        }  // déjà résolu / expiré
        if (status === 422) return false     // vraie mauvaise réponse
        return 'error'                        // réseau / 5xx / inconnu : la réponse a pu aboutir serveur
      }
      // Règle « en feu » rendue lisible : bonne réponse HORS des places en feu alors
      // qu'une série était en cours → le serveur dit QUI a été plus rapide. Toast
      // différé pour ne pas écraser le toast de victoire affiché par les branches.
      if (Array.isArray(data.streak_broken_by) && data.streak_broken_by.length) {
        const names = data.streak_broken_by.join(', ')
        // Accord du verbe : plusieurs joueurs plus rapides → variante plurielle
        // (« ont répondu ») comme le message « en feu » (streak_bar_small_multi).
        const key = data.streak_broken_by.length > 1
          ? 'toast_streak_broken_faster_multi'
          : 'toast_streak_broken_faster'
        setTimeout(() => {
          cbRef.current.showToast?.(
            (cbRef.current.t(key) || '💔 Série cassée : {names} a répondu avant toi').replace('{names}', names),
            'error'
          )
        }, 3000)
      }
      // Victoire « pour la gloire » — toutes limites atteintes : le quiz reste actif
      // pour les autres joueurs. On ferme la modale avec un résultat spécial,
      // SANS avancer le cycle (quiz toujours en cours). Le quiz:solved des autres
      // déclenchera le prochain quiz via handleQuizExpire.
      if (data.glory) {
        resolvedQuizIdsRef.current.add(activeQuiz.id)
        if (data.achievements?.length) cbRef.current.checkAchievements?.(data.achievements)
        if (data.achievement_upgrades?.length) cbRef.current.checkAchievementUpgrades?.(data.achievement_upgrades)
        // Gloire : pas de geocoin, mais on crédite les consolations cumulées (or + PF)
        // + les récompenses de quêtes HEBDO complétées (quest_gold/quest_forge légendent
        // le flash « Quête réussie ! »).
        if (data.gold_earned) earnGoldWithFx(data.gold_earned, data.quest_gold)
        cbRef.current.onForgePointsEarned?.(data.forge_points_earned || 0)
        // Flash « +N PF 🔨 » : la gloire ne rapporte souvent QUE des PF (or plafonné) →
        // souvent le seul flash affiché.
        if (data.forge_points_earned > 0) cbRef.current.showForgeFlash?.(data.forge_points_earned, data.quest_forge)
        // Choix « dépôt » refusé par le serveur (plein / or insuffisant) → gloire quand même.
        // Mécénat : le geocoin est compté comme gagné et va être offert → toast dédié (la
        // modale de choix du bénéficiaire s'ouvre juste après), pas « pour la gloire ».
        showToast(data.patronage                             ? (t('toast_patronage_win') || '🎁 Plafond atteint — geocoin à offrir !')
                : data.hold_declined === 'full'              ? (t('toast_deposit_declined_full') || '🗄️ Dépôt plein — victoire pour la gloire !')
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
          parkCountdownPastGrace(graceDeadline)
        }
        // Mécénat : plafond hebdo de la rareté atteint → proposer le don (la gloire
        // ci-dessus est le repli). La modale s'ouvre après la fermeture du quiz.
        if (data.patronage_offer) {
          const offer = data.patronage_offer
          setTimeout(() => setPatronageOffer(offer), Math.min(1200, graceDeadline ? 900 : 1200))
        }
        const closeIn = graceDeadline ? Math.max(2000, graceDeadline - Date.now() + 1200) : 3500
        setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, data.patronage_offer ? 1400 : closeIn)
        return { ok: true, outcome: 'glory', forge: data.forge_points_earned || 0 }
      }

      // Dépôt (geocoin précieux déjà possédé, hors-limite) : il consomme désormais un VRAI
      // prix (comme un gain réel) et met un exemplaire au dépôt — pas d'ajout collection ni
      // d'or, pas d'entrée « gagné par moi » perso (l'entrée du round est bâtie au quiz:solved).
      // final=false ⇒ round multi non terminé : je referme sans avancer le cycle.
      if (data.deposited) {
        resolvedQuizIdsRef.current.add(activeQuiz.id)
        // Location/remplacement payé à la volée : synchroniser le solde renvoyé et le PF de
        // consolation du geocoin sacrifié (remplacement), puis l'afficher dans le toast.
        if (typeof data.gold === 'number') cbRef.current.onGoldSync?.(data.gold)
        if (data.forge_points_earned > 0) cbRef.current.onForgePointsEarned?.(data.forge_points_earned)
        showToast(data.hold_replaced
          ? (t('toast_deposit_win_replaced') || '📥 Geocoin déposé ! (remplacement −{price} G)').replace('{price}', data.hold_price_paid)
          : data.hold_price_paid > 0
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
        // Le geocoin gagné était précieux/hors-limite et son dépôt est TOUJOURS en
        // attente côté serveur (le 1er /answer était hold-eligible, sa réponse s'est
        // perdue avant l'ouverture de la HoldModal) → on rouvre la modale au lieu de
        // le comptabiliser en collection (il n'y est pas). Sinon geocoin perdu.
        if (data.hold_eligible && data.hold_card) {
          setHoldOffer(data.hold_card)
          setTimeout(() => { setActiveQuiz(null); activeQuizRef.current = null }, 600)
          return { ok: true, outcome: 'hold', forge: 0 }
        }
        earnCard(card, data.is_shiny || false)
        setHistory(h => h.some(e => e.won && e.card?.id === card.id) ? h
          : [{ card, winner: profile?.pseudo || 'Moi', winner_avatar: profile?.geocaching_avatar_url || null, won: true, isShiny: data.is_shiny || false }, ...h].slice(0, 10))
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
      if (data.gold_earned) earnGoldWithFx(data.gold_earned, data.quest_gold)
      // Flash « +N PF 🔨 » : forge_points_earned est le total serveur (consolation hors-limite
      // + PF de quête), c.-à-d. tout ce que cette bonne réponse rapporte en PF. Affiché sous
      // le +G, ou seul quand l'or est plafonné et qu'il ne reste qu'une compensation en PF.
      if (data.forge_points_earned > 0) cbRef.current.showForgeFlash?.(data.forge_points_earned, data.quest_forge)
      if (data.streak != null) cbRef.current.onStreakUpdate?.(data.streak)
      // Inclure d'emblée les joueurs « pour la gloire » (renvoyés par /answer) : sinon
      // l'entrée n'aurait que la coche ✓ et le compteur « (N🏆) » n'apparaîtrait qu'après un
      // rechargement (le patch via quiz:solved peut manquer l'entrée pas encore créée).
      const meGloryWinners = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold, avatar: g.avatar || null }))
      setHistory(h => {
        // quiz:solved peut arriver avant la réponse HTTP (race réseau) et avoir déjà inséré
        // une entrée pour ce round : on la patche plutôt que de prepend un doublon.
        const qid = activeQuiz?.id
        if (qid) {
          const idx = h.findIndex(e => e.quiz_id === qid)
          if (idx >= 0) {
            const updated = { ...h[idx], won: true, glory_winners: meGloryWinners.length ? meGloryWinners : h[idx].glory_winners,
              winner_fire: !!data.fire, winner_fire_streak: data.fire_streak ?? null }
            return [...h.slice(0, idx), updated, ...h.slice(idx + 1)]
          }
        }
        // Pseudo + avatar réels (et non « Moi » sans avatar) : la fiche « Gagnants »
        // affiche la même chose que ce que voient les autres joueurs et qu'après rechargement.
        return [{ card, winner: profile?.pseudo || 'Moi', winner_avatar: profile?.geocaching_avatar_url || null, won: true, isShiny: data.is_shiny || false, glory_winners: meGloryWinners, quiz_id: qid,
          winner_fire: !!data.fire, winner_fire_streak: data.fire_streak ?? null }, ...h].slice(0, 10)
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
        // On NE re-crédite PAS ici : forge_points_earned (crédité plus haut) inclut déjà
        // consolation_forge côté serveur — le refaire doublait le solde local (corrigé
        // ensuite par le resync du profil, mais visible en scintillement). `forge` ne sert
        // qu'à piloter l'outcome/le retour.
        outcome = 'consolation'
        forge = data.consolation_forge ?? 0
      }

      const solvedAt = Date.now()
      if (data.final === false) {
        // Round multi-prix non terminé : je referme MA modale (j'ai déjà mon geocoin) mais
        // je n'avance PAS le cycle global — le prochain quiz est piloté par quiz:solved
        // (quand le dernier prix est pris ou la fenêtre de grâce écoulée). Le compteur est
        // repoussé au-delà de la grâce pour ne pas afficher un décompte fantôme pendant
        // que le round tourne encore (repli si le quiz:prize_won se perd).
        if (data.grace_until && data.server_time) {
          const graceMs = Math.max(0, new Date(data.grace_until).getTime() - new Date(data.server_time).getTime())
          parkCountdownPastGrace(Date.now() + graceMs)
        }
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

  const handleQuizExpire = useCallback((npc, isBot = false, isGlory = false, winnerAvatar = null, winners = null, gloryWinners = null, winnerFire = null, patronageWinners = null) => {
    const solvedAt = Date.now()

    if (!activeQuizRef.current) {
      const pending = pendingQuizRef.current
      const patronList = Array.isArray(patronageWinners) && patronageWinners.length ? patronageWinners : null
      // Round entièrement offert en mécénat (aucun vrai gagnant ni gloire) → la bannière
      // « Félicitations » se déclenche sur le 1er mécène (sinon lostTo null = pas de bannière).
      const bannerWinner = npc || (!isGlory && !(Array.isArray(gloryWinners) && gloryWinners.length) && patronList ? patronList[0].pseudo : null)
      if (pending) {
        setLostToWinner(bannerWinner)
        setLostToGlory(isGlory)
        setLostToAvatar(winnerAvatar || (npc ? null : (patronList ? patronList[0].avatar || null : null)))
        setLostToWinners(Array.isArray(winners) && winners.length > 1 ? winners : null)
        setLostToGloryWinners(Array.isArray(gloryWinners) && gloryWinners.length ? gloryWinners : null)
        setLostToPatronage(patronList)
        setLostToFire(winnerFire || null)
        setTimeout(() => {
          setLostToWinner(null)
          setLostToGlory(false)
          setLostToAvatar(null)
          setLostToWinners(null)
          setLostToGloryWinners(null)
          setLostToPatronage(null)
          setLostToFire(null)
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
      // (avatar du gagnant + liste complète des gagnants en round multi-prix +
      // joueurs « pour la gloire », affichés en petit sous le résultat).
      setActiveQuiz(q => q ? { ...q, winner: npc, winner_avatar: winnerAvatar || null,
        winners: Array.isArray(winners) && winners.length > 1 ? winners : null,
        glory_winners: Array.isArray(gloryWinners) && gloryWinners.length ? gloryWinners : null,
        patronage_winners: Array.isArray(patronageWinners) && patronageWinners.length ? patronageWinners : null,
        winner_fire_info: winnerFire || null } : null)
    }
    setTimeout(() => advanceQuiz(solvedAt), wasResolvedByMe ? 1500 : 5000)
  }, [limits])

  return {
    countdown, setNextQuizTime,
    // dynIntervalRef = dernier cycle COMPLET serveur connu (jamais un reliquat) : c'est
    // lui que doivent lire les handlers socket, montés une seule fois.
    cycleSec, serverIntervalRef: dynIntervalRef, applyServerSchedule, parkCountdownPastGrace,
    pendingQuiz, setPendingQuiz,
    activeQuiz, setActiveQuiz,
    nextCard, setNextCard,
    nextQuizRarity, setNextQuizRarity,
    holdOffer, setHoldOffer,
    patronageOffer, setPatronageOffer,
    history, setHistory,
    quizKey, setQuizKey,
    lostToWinner, setLostToWinner,
    lostToGlory, setLostToGlory,
    lostToAvatar, setLostToAvatar,
    lostToWinners, setLostToWinners,
    lostToGloryWinners, setLostToGloryWinners,
    lostToPatronage, setLostToPatronage,
    lostToFire, setLostToFire,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz,
    handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz,
  }
}
