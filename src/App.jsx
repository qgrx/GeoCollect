import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ─── i18n ─────────────────────────────────────────────────────────────────────
import { useT, setLang, LANGS, getLang } from './i18n/translations.js'
import LangSelector from './i18n/LangSelector.jsx';
import Logo from './components/Logo.jsx';

// ─── Data & utils ─────────────────────────────────────────────────────────────
import { RC, cardCC, RARITY_CONFIG, rarityLabel, cardName, typeLabel } from './data/cards.js';
import { QUIZ_INTERVAL, PSEUDO_NOTIF_DAYS, DEFAULT_RANKS, DEFAULT_RARITY_RATES } from './data/constants.js';
import { collScore } from './utils/gameUtils.js';

// ─── State hooks ──────────────────────────────────────────────────────────────
import { useGameState } from './hooks/useGameState.js'
import { useQuiz } from './hooks/useQuiz.js'
import { apiSetConfig, apiGetCurrentQuiz, apiAdminToggleQuestion, apiGetQuizHistory, apiAdminGetQuestions, apiAdminAddQuestion } from './services/api.js'
import { soundQuizNew, soundMarketSale } from './utils/sounds.js'
import { getSocket, disconnectSocket } from './services/socket.js'
import { useAuth } from './hooks/useAuth.js';

// ─── Components ───────────────────────────────────────────────────────────────
import Card from './components/Card.jsx';
import CardDetailModal from './components/CardDetailModal.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import PseudoDisplay from './components/PseudoDisplay.jsx';
import { getRank, isTopRank } from './utils/rankUtils.js';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';

// ─── Features ────────────────────────────────────────────────────────────────
import AuthModal from './features/auth/AuthModal.jsx';
import SettingsModal from './features/auth/SettingsModal.jsx';
import LandingSection from './features/landing/LandingSection.jsx';
import { QuizNotif, QuizModal, CountdownWidget, ThumbImage } from './features/quiz/QuizComponents.jsx';
import MarketModal from './features/market/MarketModal.jsx';
import LeaderboardModal from './features/leaderboard/LeaderboardModal.jsx';
import AdminPanel from './features/admin/AdminPanel.jsx';
import ShopModal from './features/shop/ShopModal.jsx';
import { AchievementToast, SaleNotif, TxHistoryModal } from './features/achievements/NotifComponents.jsx';
import DailyQuests from './features/quests/DailyQuests.jsx';

function OfferedCardModal({ card, remaining, lang, t, onDismiss }) {
  const imgRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const { c1, c2 } = cardCC(card.rarity)
  const rc = RC[card.rarity] || RC.commun
  const isLast = remaining === 1
  const hasImage = !!(card.image || card.image_url)

  const onMove = useCallback(e => {
    const el = imgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const cx = (clientX - r.left) / r.width - 0.5
    const cy = (clientY - r.top) / r.height - 0.5
    setTilt({ x: cy * -20, y: cx * 20 })
  }, [])
  const onLeave = useCallback(() => setTilt({ x: 0, y: 0 }), [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'#000000cc', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Nunito',sans-serif" }}>
      <style>{`
        @keyframes cardOfferPop{from{opacity:0;transform:scale(.8) translateY(24px)}to{opacity:1;transform:none}}
        @keyframes shimmerOffer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes pulseGlow{0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>
      <div style={{ width:'min(92vw,360px)', borderRadius:24, overflow:'hidden', background:`linear-gradient(160deg,${c1}22,#0f0f1e 50%)`, border:`2px solid ${c1}66`, boxShadow:`0 0 80px ${c1}44, 0 32px 80px #000e`, animation:'cardOfferPop .4s cubic-bezier(.34,1.56,.64,1) both' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(90deg,${c1},${c2})`, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent 40%,#ffffff22 50%,transparent 60%)', backgroundSize:'400px 100%', animation:'shimmerOffer 2.5s linear infinite' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#fff', textTransform:'uppercase', letterSpacing:1 }}>🎁 Geocoin offert !</div>
            {remaining > 1 && <div style={{ fontSize:10, color:'#ffffffaa' }}>{remaining} geocoins à recevoir</div>}
          </div>
          <div style={{ position:'relative', fontSize:10, fontWeight:800, color:'#ffffffcc', background:'#00000033', borderRadius:50, padding:'3px 10px' }}>{rarityLabel(card.rarity, t)}</div>
        </div>

        {/* Image avec tilt 3D */}
        <div
          ref={imgRef}
          onMouseMove={onMove} onMouseLeave={onLeave}
          onTouchMove={onMove} onTouchEnd={onLeave}
          style={{ height: hasImage ? 260 : 180, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', padding:16, perspective:'800px', cursor:'default' }}
        >
          <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at center,${c1}33 0%,transparent 70%)`, animation:'pulseGlow 2s infinite', pointerEvents:'none' }}/>
          {hasImage
            ? <img
                src={card.image || card.image_url}
                alt={card.name}
                style={{
                  maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:12,
                  filter:`drop-shadow(0 0 24px ${c1}88)`,
                  transform:`rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.05 : 1})`,
                  transition: tilt.x || tilt.y ? 'transform .1s ease-out' : 'transform .4s ease',
                }}
              />
            : <div style={{ fontSize:80, opacity:.2 }}>🃏</div>
          }
        </div>

        {/* Infos + bouton */}
        <div style={{ padding:'0 20px 20px' }}>
          <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:26, color:'#fff', marginBottom:4 }}>{cardName(card, lang)}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <span style={{ color:rc.color, fontSize:14 }}>{'★'.repeat(rc.stars||1)}{'☆'.repeat(4-(rc.stars||1))}</span>
            <span style={{ fontSize:11, fontWeight:800, color:rc.color, background:rc.bg, borderRadius:50, padding:'2px 10px' }}>{rarityLabel(card.rarity, t)}</span>
          </div>
          <button onClick={onDismiss} style={{ width:'100%', background:`linear-gradient(135deg,${c1},${c2})`, border:'none', color:'#fff', padding:'14px', borderRadius:14, fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:16, cursor:'pointer', boxShadow:`0 4px 20px ${c1}66`, letterSpacing:.3 }}>
            {isLast ? 'Recevoir 🎉' : 'Recevoir →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { t, lang } = useT();

  // ── Game state (all logic lives in the hook) ───────────────────────────────
  const auth = useAuth()
  const gs   = useGameState(auth, {
    onAchievementCard: (card) => setWelcomeCards(prev => [...prev, card])
  });

  const cardPoolRef = useRef(gs.cardPool);
  useEffect(() => { cardPoolRef.current = gs.cardPool }, [gs.cardPool]);

  // ── Confirmation email (lien Supabase → connexion automatique) ───────────────
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace('#', '?'))
    const params = new URLSearchParams(window.location.search)
    const type = hash.get('type') || params.get('type')
    const token = hash.get('access_token')
    if (type === 'signup' && token) {
      // Supabase a déjà géré la session via onAuthStateChange
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => showToast('✅ Email confirmé ! Bienvenue 🎉'), 500)
    }
  }, [])

  // ── Charger l'historique des quiz depuis la DB ────────────────────────────────
  useEffect(() => {
    if (!auth.profile || !import.meta.env.VITE_API_URL) return
    apiGetQuizHistory(10).then(({ data }) => {
      if (data?.history?.length) {
        // Sécurité : filtrer d'éventuelles ventes qui se seraient glissées depuis l'API
        setHistory(data.history.filter(h => h.price === undefined && h.type !== 'vente' && h.type !== 'achat' && h.buyer === undefined))
      }
    }).catch(() => {})
  }, [auth.profile?.id])

  // ── Notifications navigateur ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [auth.profile?.id])

  function sendPushNotif(card) {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return  // onglet actif → pas besoin
    const n = new Notification('🃏 Nouvelle carte disponible !', {
      body: `${card.name} — Réponds le premier pour la gagner !`,
      icon: '/favicon.ico',
      tag:  'quiz-new',   // remplace la notif précédente si déjà affichée
    })
    n.onclick = () => { window.focus(); n.close() }
  }

  // ── Socket.io — connexion temps réel ─────────────────────────────────────────
  useEffect(() => {
    if (!auth.profile) return  // pas de socket si non connecté

    let socket
    // Pull initial : récupérer le quiz en cours pour aligner le countdown
    apiGetCurrentQuiz().then(({ data }) => {
      if (!data) return
      const cycleTime = gs.limits?.quizInterval ?? QUIZ_INTERVAL

      // Calcul du countdown — compensé avec l'heure du serveur (immunisé au Clock Skew)
      if (data.last_quiz_solved_at && !data.quiz) {
        const solvedAt = new Date(data.last_quiz_solved_at).getTime()
        const serverNow = data.server_time ? new Date(data.server_time).getTime() : Date.now()
        const elapsed = (serverNow - solvedAt) / 1000
        const rem = Math.max(1, cycleTime - elapsed)
        setNextQuizTime(Date.now() + rem * 1000)
      }

      // Le quiz est actif indéfiniment jusqu'à ce que quelqu'un réponde
      if (data.quiz) {
        const poolCard = cardPoolRef.current?.find(c => c.id === data.quiz.card.id) || {}
        const card = { ...data.quiz.card, ...poolCard, sellable: true, minPrice: null, desc: '' }
        const wc   = data.quiz.answer_word_count || 1
        const initLang = getLang()
        const initTrans = data.quiz.translations?.[initLang]
        setPendingQuiz({
          ...data.quiz,
          card,
          id: data.quiz.id,
          q:  initTrans?.question || data.quiz.question,
          a:  initTrans?.answer ? Array((initTrans.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
          h:  data.quiz.hint,
          answer_length: data.quiz.answer_length,
        })
        setQuizKey(k => k + 1)
        setNextCard(card)
        setQuizSessionActive(true)
      }
    }).catch(() => {})

    getSocket().then(s => {
      if (!s) return  // API non configurée
      socket = s

      // Quiz — nouveau quiz disponible
      s.on('quiz:new', (data) => {
        const poolCard = cardPoolRef.current?.find(c => c.id === data.card?.id) || {}
        const card = { ...data.card, ...poolCard, sellable: true, minPrice: null, desc: '' }
        const wc = data.answer_word_count || 1
        const fakeAnswer = Array(wc).fill('x').join(' ')
        const curLang = getLang()
        const trans = data.translations?.[curLang]
        const q = {
          ...data,
          card,
          id:   data.quiz_id,
          q:    trans?.question || data.question,
          a:    trans?.answer ? Array((trans.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : fakeAnswer,
          h:    data.hint,
          answer_length: data.answer_length,
        }
        setNextCard(card)

        // Si le backend envoie le quiz en avance (désynchro de ~10s due au temps de réponse),
        // on patiente pour que le compte à rebours tombe parfaitement à zéro !
        const remMs = nextQuizTimeRef.current - Date.now()
        const activate = () => {
          setNextQuizTime(Date.now() + (data.next_quiz_in ?? 60) * 1000)
          setActiveQuiz(null)
          activeQuizRef.current = null
          setQuizKey(k => k + 1)
          setQuizSessionActive(true)
          if (Date.now() >= snoozedUntilRef.current) {
            setPendingQuiz(q)
            soundQuizNew()
          }
          sendPushNotif(card)
        }
        
        if (remMs > 500 && remMs < 20000) setTimeout(activate, remMs)
        else activate()
      })

      // Quiz — résolu par quelqu'un
      s.on('quiz:solved', (data) => {
        // Sécurité : ignorer si l'événement WebSocket contient des attributs de transaction (bug backend)
        if (data.price !== undefined || data.buyer !== undefined || data.type === 'vente' || data.type === 'achat') return;
        
        setQuizSessionActive(false)
        const iSelf = data.winner && data.winner === auth.profile?.pseudo
        const wasPlayingOrPending = !!(activeQuizRef.current || pendingQuizRef.current)

        // Si le joueur courant n'a pas lui-même gagné, on délègue au hook
        // (il se chargera de fermer la fenêtre active ou la notification en attente)
        if (!iSelf) {
          handleQuizExpire(data.winner, data.is_bot)
        }

        // N'ajouter à l'historique que si on n'avait pas la carte sous les yeux
        // (si elle y était, handleQuizExpire l'a déjà ajoutée avec toutes ses caractéristiques)
        if (data.winner && !iSelf && !wasPlayingOrPending) {
          const fullCard = cardPoolRef.current?.find(c => c.name === data.card_name) || { name: data.card_name, rarity: data.rarity, type: 'Normal', id: 0 };
          setHistory(h => [{
            card: fullCard,
            winner: data.winner,
            won: false,
            isBot: data.is_bot || false,
          }, ...h].slice(0, 10))
        }
      })

      // Marché — ma carte vendue
      s.on('market:sold', (data) => {
        gs.handleSaleNotifFromSocket(data)
        soundMarketSale()
      })

      // Maintenance
      s.on('maintenance', (val) => {
        const isOn = val === 'true' || val === true
        gs.setMaintenance(prev => ({ ...prev, on: isOn }))
      })

      s.on('announcement', ({ message, type }) => {
        showToast(message, type === 'error' ? 'error' : 'success')
      })

      s.on('connect',    () => {
        setSocketOnline(true)
      })
      s.on('disconnect', () => setSocketOnline(false))
      s.on('connect_error', () => setSocketOnline(false))
    })

    return () => {
      socket?.off('quiz:new')
      socket?.off('quiz:solved')
      socket?.off('market:sold')
      socket?.off('maintenance')
      socket?.off('connect')
      socket?.off('disconnect')
      socket?.off('connect_error')
    }
  }, [auth.profile?.id])

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [showMarket,      setShowMarket]      = useState(false);
  useEffect(() => { gs.marketOpenRef.current = showMarket }, [showMarket]);
  const [marketTab,       setMarketTab]       = useState('acheter');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);
  const [showAuth,        setShowAuth]        = useState(false);
  const [showChoosePseudo, setShowChoosePseudo] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showShop,        setShowShop]        = useState(false);
  const [showTxHistory,   setShowTxHistory]   = useState(false);
  const [filter,          setFilter]          = useState('Tous');
  const [showMissing,     setShowMissing]     = useState(false);
  const [cardSearch,      setCardSearch]      = useState('');
  const [collPage,        setCollPage]        = useState(0);
  const [quizSessionActive, setQuizSessionActive] = useState(false);
  const COLL_PAGE_SIZE = 24;
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [selectedCard,    setSelectedCard]    = useState(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const avatarMenuRef = useRef(null);
  const [welcomeCards, setWelcomeCards] = useState([]);  // cartes offertes à afficher avant le tour
  const [marketUnlockBanner, setMarketUnlockBanner] = useState(false);
  const [toast,           setToast]           = useState(null);
  const [socketOnline,    setSocketOnline]    = useState(true);
  const [goldFlash,       setGoldFlash]       = useState(null);
  const [showScrollTop,   setShowScrollTop]   = useState(false);

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!showAdmin || !auth.profile) return
    apiAdminGetQuestions().then(({ data }) => {
      if (data?.questions) setQuestions(data.questions.map(q => ({
        id: q.id, q: q.question, a: q.answer, hint: q.hint || '', active: q.active, translations: q.translations || {}
      })))
    })
  }, [showAdmin])

  // ── Re-traduire le quiz courant quand la langue change ─────────────────────
  useEffect(() => {
    const applyTrans = q => {
      if (!q) return null
      const trans = q.translations?.[lang]
      if (!trans?.question) return q
      return { ...q, q: trans.question }
    }
    setPendingQuiz(applyTrans)
    setActiveQuiz(applyTrans)
  }, [lang])

  // ── Détection mobile ───────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 520)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 520)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Clic en dehors du menu avatar ──────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenu(false)
      }
    }
    if (avatarMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [avatarMenu])

  // ── Toast / Gold flash ─────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }
  function showGoldFlash(n) {
    setGoldFlash(n);
    setTimeout(() => setGoldFlash(null), 1800);
  }

  // ── Gold / card earn wrappers ─────────────────────────────────────────────
  function earnGoldWithFx(n) {
    const gained = gs.earnGold(n);
    if (gained > 0) showGoldFlash(gained);
    return gained;
  }

  // ── Quiz (logique extraite dans useQuiz) ────────────────────────────────────
  const quiz = useQuiz({
    profile: auth.profile,
    limits: gs.limits,
    earnGoldWithFx,
    earnCard: gs.earnCard,
    showToast,
    showGoldFlash,
    t,
    onStreakUpdate: gs.setStreak,
    onQuizEnd: () => setQuizSessionActive(false),
    cardPool: gs.cardPool,
    checkAchievements: gs.checkAchievements,
    onForgePointsEarned: gs.addForgePoints,
  })
  const { countdown, setNextQuizTime, pendingQuiz, setPendingQuiz, activeQuiz, setActiveQuiz,
    nextCard, setNextCard, history, setHistory, quizKey, setQuizKey,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz, handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz } = quiz

  // Titre fixe — le favicon (pin vert) est affiché dans l'onglet par index.html
  useEffect(() => { document.title = 'Geocoins' }, [])


  // ── Market actions with toasts ─────────────────────────────────────────────
  function handleBuy(listing, index) {
    const res = gs.handleBuy(listing, index);
    if (res === 'insufficient') { showToast('Pas assez d\'or ! 💸', 'error'); return; }
    showToast(t('toast_bought').replace('{card}', listing.card.name).replace('{price}', listing.price));
  }
  function handleListCard(card, price) {
    gs.handleListCard(card, price, auth.profile?.pseudo || 'Moi');
    showToast(t('toast_listed').replace('{card}', card.name).replace('{price}', price));
  }
  function handleCancelListing(index) {
    gs.handleCancelListing(index, auth.profile?.pseudo || 'Moi');
    showToast(t('toast_listing_cancelled'));
  }
  function handleCancelAllListings() {
    if (!window.confirm("Êtes-vous sûr de vouloir retirer toutes vos annonces ?")) return;
    gs.handleCancelAllListings();
    showToast("Toutes vos annonces ont été retirées !");
  }
  // Wrapper — bloque la soumission pour les non-connectés et propose l'inscription
  const wrappedHandleQuizAnswer = async (_userAnswer, _turnstileToken) => {
    if (!auth.profile) {
      setShowRegisterPrompt(true)
      return false
    }
    return handleQuizAnswer(_userAnswer, _turnstileToken)
  }

  async function handlePurchase(cards) {
    // Mise à jour locale optimiste
    cards.forEach(card => gs.earnCard(card))
    showToast(t('toast_pack_added'))
    // Persistance en DB si connecté
    if (auth.profile && import.meta.env.VITE_API_URL) {
      const { apiGiveCard } = await import('./services/api.js').catch(() => ({}))
      if (apiGiveCard) {
        for (const card of cards) {
          apiGiveCard(auth.profile.id, card.id).catch(() => {})
        }
      }
    }
  }
  // Called by AuthModal after successful login
  function handleLoginSuccess(profile) {
    showToast(t('toast_welcome').replace('{pseudo}', profile?.pseudo || ''))
  }

  // Welcome card + tuto — basé sur welcome_given en base (pas localStorage)
  useEffect(() => {
    if (!auth.profile || !import.meta.env.VITE_API_URL) return
    if (auth.profile.welcome_given) return // onboarding déjà complété
    const run = async () => {
      const { apiWelcomeCard } = await import('./services/api.js')
      const { data } = await apiWelcomeCard()
      const newCards = data?.cards || []
      if (newCards.length > 0) {
        newCards.forEach(c => gs.setCollection(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 })))
        setTimeout(() => setWelcomeCards(newCards), 800)
      } else if (!auth.profile.welcome_given) {
        setTimeout(() => setShowTour(true), 1200)
      }
    }
    run()
  }, [auth.profile?.id])

  // Détecter un profil Google dont le pseudo vient du fournisseur (email-like ou nom complet)
  useEffect(() => {
    if (!auth.profile || !auth.user) return
    const providers = auth.user.app_metadata?.providers || []
    const isOAuth = providers.includes('google') || providers.includes('github')
    if (!isOAuth) return
    const p = auth.profile.pseudo || ''
    if (p.includes(' ') || p.includes('@') || p.includes('.')) {
      setShowChoosePseudo(true)
    }
  }, [auth.profile?.id])

  // ── Raccourcis clavier globaux ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        if (selectedCard)       { setSelectedCard(null); return }
        if (showMarket)         { setShowMarket(false); setMarketTab('acheter'); return }
        if (showLeaderboard)    { setShowLeaderboard(false); return }
        if (showSettings)       { setShowSettings(false); return }
        if (showAuth)           { setShowAuth(false); return }
        if (showTxHistory)      { setShowTxHistory(false); return }
        if (showAdmin)          { setShowAdmin(false); return }
        if (showShop)           { setShowShop(false); return }
        if (menuOpen)           { setMenuOpen(false); return }
      }
      if (e.key === 'Enter' && pendingQuiz && !activeQuiz) { handleJoin(); return }
      if (e.key === 'm' && !e.ctrlKey) { setShowMarket(v => !v); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCard, showMarket, showLeaderboard, showSettings, showAuth,
      showTxHistory, showAdmin, showShop, menuOpen, pendingQuiz, activeQuiz])

  // ── Scroll to Top ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Bannière déblocage marché — seulement pour les non-connectés au premier doublon
  const hasDuplicate = useMemo(
    () => Object.values(gs.collection).some(n => n > 1),
    [gs.collection]
  )
  const userScore = useMemo(
    () => collScore(gs.collection, gs.cardPool),
    [gs.collection, gs.cardPool]
  )
  const prevHadDuplicate = useRef(false)
  useEffect(() => {
    if (auth.profile) return  // connecté → pas de bannière
    if (!prevHadDuplicate.current && hasDuplicate) {
      setMarketUnlockBanner(true)
    }
    prevHadDuplicate.current = hasDuplicate
  }, [hasDuplicate, auth.profile])
  async function handleChangePseudo(newP) {
    const { error } = await auth.updatePseudo(newP)
    if (!error) showToast(t('toast_pseudo_changed').replace('{pseudo}', newP))
  }

  // ── Derived display state ─────────────────────────────────────────────────
  const types = ['Tous', ...new Set(gs.cardPool.filter(c => c.type !== 'Achievement').map(c => c.type).filter(Boolean))];
  const displayCards = useMemo(() => {
    const af = filter === 'Tous';
    const q = cardSearch.trim().toLowerCase();
    const matchSearch = card => !q || card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q);
    if (showMissing) {
      return gs.cardPool
        .filter(c => (af || c.type === filter) && matchSearch(c))
        .map(c => ({ card: c, count: gs.collection[c.id] || 0, missing: !(gs.collection[c.id] > 0) }))
        .sort((a, b) => RARITY_CONFIG[a.card.rarity].order - RARITY_CONFIG[b.card.rarity].order);
    }
    return Object.entries(gs.collection)
      .filter(([, v]) => v > 0)
      .map(([id, cnt]) => ({ card: gs.cardPool.find(c => c.id === +id), cnt, missing: false }))
      .filter(x => x.card && (af || x.card.type === filter) && matchSearch(x.card))
      .sort((a, b) => RARITY_CONFIG[a.card.rarity].order - RARITY_CONFIG[b.card.rarity].order);
  }, [showMissing, filter, cardSearch, gs.collection, gs.cardPool]);

  const pseudoChangedAt = auth.profile?.pseudo_changed_at ? new Date(auth.profile.pseudo_changed_at).getTime() : 0
  const pseudoChanged   = pseudoChangedAt > 0 && (Date.now() - pseudoChangedAt) < PSEUDO_NOTIF_DAYS * 864e5

  if (gs.maintenance.on && !auth.loading) return (
    <MaintenanceScreen
      text={gs.maintenance.text}
      isAdmin={auth.profile?.role === 'admin'}
      onDisable={async () => {
        await apiSetConfig('maintenance', false)
        gs.setMaintenance({ on: false, text: '' })
      }}
    />
  );

  // SPA : seul "/" est valide, tout autre chemin affiche 404
  if (window.location.pathname !== '/' && !window.location.hash.includes('access_token')) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito',sans-serif", color: '#fff', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 72 }}>🗺️</div>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 48, color: '#f9ca24' }}>404</div>
        <div style={{ color: '#888', fontSize: 16 }}>Cette page n'existe pas.</div>
        <button onClick={() => window.location.href = '/'} style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
          Retour à l'accueil
        </button>
      </div>
    )
  }

  if (auth.loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f1e', fontFamily: "'Nunito',sans-serif", color: '#fff' }}>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}} @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
      {/* Rainbow bar */}
      <div style={{ background: 'linear-gradient(90deg,#74c7ec,#1565c0,#6a1b9a,#e65100,#ffd54f)', height: 4 }}/>
      {/* Header skeleton */}
      <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ffffff0a' }}>
        <div style={{ width: 120, height: 28, borderRadius: 8, background: 'linear-gradient(90deg,#ffffff0a,#ffffff18,#ffffff0a)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }}/>
        <div style={{ display: 'flex', gap: 8 }}>
          {[80, 70, 60, 50].map(w => <div key={w} style={{ width: w, height: 30, borderRadius: 50, background: 'linear-gradient(90deg,#ffffff0a,#ffffff18,#ffffff0a)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }}/>)}
        </div>
      </div>
      {/* Countdown skeleton */}
      <div style={{ padding: '12px 18px' }}>
        <div style={{ height: 58, borderRadius: 13, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }}/>
      </div>
      {/* Cards skeleton */}
      <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ width: 100, height: 140, borderRadius: 16, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.08}s infinite` }}/>
        ))}
      </div>
      {/* Logo centré */}
      <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', animation: 'pulse 1.8s infinite' }}>
        <Logo iconSize={28} textSize={17} dim />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh',fontFamily: "'Nunito', sans-serif",color: '#fff',paddingBottom: 20 }}>
      <style>{`
        @keyframes pulseBadge {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
          70% { transform: scale(1.15); box-shadow: 0 0 0 5px rgba(231, 76, 60, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
        }
      `}</style>

      {/* Rainbow bar */}
      <div style={{ background: 'linear-gradient(90deg,#74c7ec,#1565c0,#6a1b9a,#e65100,#ffd54f)',backgroundSize: '300% 100%',animation: 'shimmer 6s linear infinite',height: 4 }} />

      {/* ── Header ── */}
      <div style={{ position: 'relative', zIndex: 100, background: '#00000055', backdropFilter: 'blur(14px)', padding: isMobile ? '8px 10px' : '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ffffff12', gap: 6 }}>

        {/* Logo */}
        <Logo iconSize={isMobile ? 28 : 34} textSize={isMobile ? 17 : 22} />

        {/* Stats compactes — connecté seulement */}
        {auth.profile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: isMobile ? 13 : 14, color: '#f9ca24' }} data-tour="gold">💰 {gs.gold}G</div>
            {gs.forgePoints > 0 && (
              <div style={{ fontWeight: 900, fontSize: isMobile ? 11 : 12, color: '#a29bfe', display: 'flex', alignItems: 'center', gap: 3 }}>
                🔨 {gs.forgePoints}
              </div>
            )}
          </div>
        )}

        {/* Actions droite */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          {auth.profile ? (
            <>
              {/* Marché */}
              {(auth.profile || hasDuplicate) && (
                <button data-tour="market-btn" onClick={() => setShowMarket(true)}
                  style={{ position: 'relative', background: 'linear-gradient(135deg,#00b894,#00cec9)', border: 'none', color: '#fff', padding: isMobile ? '7px 10px' : '7px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900 }}>
                  {isMobile ? '🏪' : t('btn_market')}
                  {gs.unreadSales > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 900, borderRadius: '50%', padding: '2px 5px', border: '1.5px solid #1a1a2e', animation: 'pulseBadge 1.5s infinite' }}>{gs.unreadSales}</span>}
                </button>
              )}
              {/* Classement */}
              {gs.limits.leaderboardVisible !== false && (
                <button data-tour="leaderboard-btn" onClick={() => setShowLeaderboard(true)}
                  style={{ background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1a1a2e', padding: isMobile ? '7px 10px' : '7px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900 }}>
                  {t('btn_leaderboard')}
                </button>
              )}

              {/* Avatar + menu déroulant */}
              <div style={{ position: 'relative' }} ref={avatarMenuRef}>
                <button onClick={() => setAvatarMenu(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: avatarMenu ? '#ffffff22' : '#ffffff0a', borderRadius: 20, padding: isMobile ? '5px 8px 5px 5px' : '5px 10px 5px 5px', border: '1px solid #ffffff18', cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffffff16'}
                  onMouseLeave={e => e.currentTarget.style.background = avatarMenu ? '#ffffff22' : '#ffffff0a'}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#1a1a2e', flexShrink: 0 }}>
                    {auth.profile.pseudo[0].toUpperCase()}
                  </div>
                  {!isMobile && <PseudoDisplay pseudo={auth.profile.pseudo} score={userScore} ranks={gs.limits.playerRanks} style={{ fontSize: 12, fontWeight: 800, color: '#fff', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}/>}
                  <span style={{ fontSize: 10, color: '#888' }}>▾</span>
                </button>

                {avatarMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'linear-gradient(145deg,#1a1a2e,#16213e)', border: '1px solid #ffffff18', borderRadius: 14, boxShadow: '0 12px 40px #000b', zIndex: 99999, minWidth: 190, overflow: 'hidden', fontFamily: "'Nunito',sans-serif" }}>
                      {/* Sélecteur de langue */}
                      <div style={{ padding: '8px 10px 4px', borderBottom: '1px solid #ffffff10' }}>
                        <div style={{ fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5, paddingLeft: 4 }}>Langue</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Object.entries(LANGS).map(([code, label]) => (
                            <button key={code} onClick={() => setLang(code)}
                              style={{ background: lang === code ? '#f9ca2433' : '#ffffff0a', border: lang === code ? '1px solid #f9ca2455' : '1px solid #ffffff18', color: lang === code ? '#f9ca24' : '#aaa', padding: '3px 9px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Actions */}
                      {[
                        { icon: '👤', label: t('menu_account') || 'Mon compte', fn: () => { setShowSettings(true); setAvatarMenu(false) } },
                        ...(gs.limits.supportVisible !== false ? [{ icon: '💝', label: t('menu_support') || 'Soutenir', fn: () => { setShowShop(true); setAvatarMenu(false) } }] : []),
                        ...(auth.profile?.role === 'admin' ? [{ icon: '🔧', label: t('menu_admin') || 'Administration', fn: () => { setShowAdmin(true); setAvatarMenu(false) } }] : []),
                        null,
                        { icon: '↩', label: t('btn_logout'), color: '#e74c3c', fn: () => { auth.signOut(); setAvatarMenu(false); setHistory([]); setPendingQuiz(null); setActiveQuiz(null); } },
                      ].map((item, i) => item === null ? (
                        <div key={i} style={{ height: 1, background: '#ffffff10' }}/>
                      ) : (
                        <button key={i} onClick={item.fn}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', color: item.color || '#fff', padding: '10px 14px', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ffffff0f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <LangSelector />
              <button onClick={() => setShowAuth(true)}
                style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900 }}>
                {t('btn_login')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Countdown ── */}
      {auth.profile && (
        <div style={{ padding: isMobile ? '8px 10px 0' : '10px 18px 0' }}>
          {!activeQuiz && auth.profile?.status !== 'banni' && <div data-tour="countdown"><CountdownWidget secondsLeft={countdown} cycleTime={gs.limits?.quizInterval ?? QUIZ_INTERVAL} nextCard={nextCard} hasPendingQuiz={quizSessionActive} onJoin={handleJoin} /></div>}
        </div>
      )}

      {/* ── Quêtes du jour + historique ── */}
      {auth.profile && (
        <div style={{ padding: '6px 18px 0', display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
          <DailyQuests questActivitySignal={gs.questActivitySignal} />
          {history.filter(h => !h.skipped).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9,color: '#555',fontWeight: 700,textTransform: 'uppercase',letterSpacing: 1 }}>{t('last_cards')}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {history.filter(h => !h.skipped).slice(0, 5).map((h, i) => {
                  const { c1, c2 } = cardCC(h.card?.rarity || 'commun');
                  return (
                    <div key={i} title={h.card?.name} onClick={() => h.card && setSelectedCard(gs.cardPool.find(c => c.id === h.card.id) || h.card)} style={{ display: 'flex',flexDirection: 'column',alignItems: 'center',gap: 3, cursor: 'pointer' }}>
                      <div style={{ position: 'relative', width: 40, height: 40, transition: 'all 0.2s', zIndex: 1 }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.7)'; e.currentTarget.style.zIndex = 10; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1; }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', position: 'relative', border: `2px solid ${c1}`, background: '#1a1a2e', boxSizing: 'border-box', boxShadow: h.card?.rarity === 'légendaire' ? `0 0 12px ${c1}aa` : 'none' }}>
                          {h.card ? (
                            (h.card.thumbnail || h.card.image_url_thumb || h.card.image || h.card.image_url) ? (
                              <ThumbImage src={h.card.thumbnail || h.card.image_url_thumb || h.card.image || h.card.image_url} alt={h.card.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{h.card.name[0]}</div>
                            )
                          ) : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#555'}}>?</div>}
                        </div>
                      </div>
                      <div style={{ fontSize: 8,fontWeight:700,color:'#ccc',maxWidth:36,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {h.won ? '✓' : h.winner}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Landing — non connecté ── */}
      {!auth.profile && import.meta.env.VITE_API_URL && (
        <LandingSection onOpenAuth={() => setShowAuth(true)} />
      )}

      {/* ── Filters ── */}
      {(auth.profile || !import.meta.env.VITE_API_URL) && <div style={{ padding: isMobile ? '8px 10px 0' : '10px 18px 0' }}>
        {/* ── Compteurs par type — scroll horizontal ── */}
        {auth.profile && gs.cardPool.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {types.map(tp => {
              const pool  = tp === 'Tous'
                ? gs.cardPool.filter(c => c.rarity !== 'achievement' && c.type !== 'Achievement')
                : gs.cardPool.filter(c => c.type === tp)
              const total = pool.length
              const owned = pool.filter(c => (gs.collection[c.id] || 0) > 0).length
              const pct   = total > 0 ? Math.round(owned / total * 100) : 0
              const full  = owned === total && total > 0
              const active = filter === tp
              return (
                <button key={tp} onClick={() => { setFilter(tp); setCollPage(0); }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, background: active ? '#f9ca24' : '#ffffff08', border: `1px solid ${active ? '#f9ca24' : '#ffffff0f'}`, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all .15s', alignItems: 'center', minWidth: 58 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: active ? '#1a1a2e' : full ? '#00b894' : '#999', whiteSpace: 'nowrap' }}>{tp === 'Tous' ? t('filter_all') : typeLabel(tp, gs.limits.typeTranslations, lang)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#1a1a2e' : full ? '#00b894' : '#f9ca24', whiteSpace: 'nowrap', lineHeight: 1 }}>{owned}<span style={{ color: active ? '#00000055' : '#555', fontWeight: 600 }}>/{total}</span></span>
                    <div style={{ flex: 1, height: 2, borderRadius: 2, background: active ? '#00000022' : '#ffffff10', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: active ? '#1a1a2e' : full ? '#00b894' : 'linear-gradient(90deg,#f9ca24,#e17055)', transition: 'width .6s' }}/>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input value={cardSearch} onChange={e => { setCardSearch(e.target.value); setSelectedCard(null); setCollPage(0); }}
            placeholder={t('collection_search')}
            style={{ flex: 1, boxSizing: 'border-box', background: '#ffffff0f', border: '1px solid #ffffff18', borderRadius: 10, color: '#fff', padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none' }}/>
          <button onClick={() => { setShowMissing(v => !v); setCollPage(0); }} style={{ flexShrink: 0, background: showMissing ? '#6c5ce7' : '#ffffff15', border: 'none', color: '#fff', padding: '7px 12px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {showMissing ? t('filter_owned') : t('filter_missing')}
          </button>
        </div>
      </div>}

      {/* ── Collection grid ── */}
      {(auth.profile || !import.meta.env.VITE_API_URL) && <div style={{ padding: isMobile ? '10px 10px' : '12px 18px' }}>
        {displayCards.length === 0 ? (
          <div style={{ textAlign: 'center',color: '#888',padding: '44px 0' }}>
            <div style={{ fontSize: 52 }}>📭</div>
            <div style={{ marginTop: 9,fontSize: 14 }}>{t('no_cards')}</div>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(displayCards.length / COLL_PAGE_SIZE)
          const page = Math.min(collPage, totalPages - 1)
          const slice = displayCards.slice(page * COLL_PAGE_SIZE, (page + 1) * COLL_PAGE_SIZE)
          return (
            <>
              <div style={{ display: 'flex',flexWrap: 'wrap',gap: 12,marginBottom: 16 }}>
                {slice.map(({ card, count, cnt, missing }, idx) => {
                  const c = count || cnt || 0;
                  return (
                    <div key={card.id} style={{ animation: 'slideIn .35s ease both' }} {...(idx === 0 ? { 'data-tour': 'collection' } : {})}>
                      <Card card={card} count={missing ? 0 : c} dimmed={missing}
                        onClick={missing ? undefined : () => setSelectedCard(card)} />
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex',alignItems: 'center',justifyContent: 'center',gap: 8,paddingBottom: 8 }}>
                  <button onClick={() => setCollPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ background: page===0?'#ffffff0a':'#ffffff18',border:'none',color:page===0?'#444':'#fff',width:32,height:32,borderRadius:9,cursor:page===0?'default':'pointer',fontWeight:900,fontSize:15 }}>‹</button>
                  <span style={{ fontSize: 12,color: '#888',fontWeight: 700 }}>{page + 1} / {totalPages}</span>
                  <span style={{ fontSize: 11,color: '#555' }}>({displayCards.length} cartes)</span>
                  <button onClick={() => setCollPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                    style={{ background: page===totalPages-1?'#ffffff0a':'#ffffff18',border:'none',color:page===totalPages-1?'#444':'#fff',width:32,height:32,borderRadius:9,cursor:page===totalPages-1?'default':'pointer',fontWeight:900,fontSize:15 }}>›</button>
                </div>
              )}
            </>
          )
        })()}
      </div>}

      {/* ── Gold flash ── */}
      {goldFlash && (
        <div style={{ position: 'fixed',top: '50%',left: '50%',zIndex: 4000,pointerEvents: 'none',animation: 'goldPop 1.8s ease-out forwards',fontFamily: "'Fredoka One',sans-serif",fontSize: 52,color: '#f9ca24',textShadow: '0 4px 24px #f9ca2488',whiteSpace: 'nowrap' }}>
          +{goldFlash}G 💰
        </div>
      )}

      {/* ── Toast ── */}
      {!socketOnline && import.meta.env.VITE_API_URL && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#d63031', color: '#fff', textAlign: 'center', padding: '7px 16px', fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>
          {t('server_offline')}
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed',bottom: 28,right: 28,zIndex: 3000,background: toast.type === 'error' ? '#d63031' : '#00b894',color: '#fff',padding: '11px 18px',borderRadius: 12,fontWeight: 800,fontSize: 13,boxShadow: '0 8px 32px #0006',animation: 'toastIn .4s cubic-bezier(.34,1.56,.64,1) both' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Achievement toast queue ── */}
      {gs.pendingAch.length > 0 && (
        <AchievementToast achievement={gs.pendingAch[0]} cardPool={gs.cardPool} onClose={() => gs.setPendingAch(prev => prev.slice(1))} />
      )}

      {/* ── Sale notifications ── */}
      {gs.saleNotifs.slice(0, 3).map((n, i) => (
        <div key={n.id} style={{ position: 'fixed', top: `${70 + i * 90}px`, right: 20, zIndex: 3500 }}>
          <SaleNotif notif={n} ranks={gs.limits.playerRanks} onClose={() => gs.setSaleNotifs(prev => prev.filter(x => x.id !== n.id))} />
        </div>
      ))}

      {/* ── Guest banner ── */}
      {!import.meta.env.VITE_API_URL && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#2d3436', borderTop: '2px solid #636e72', padding: '7px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 500, fontSize: 11, color: '#aaa', fontFamily: "'Nunito',sans-serif" }}>
          <span style={{ fontSize: 16 }}>🧪</span>
          <div><strong style={{ color: '#fff' }}>{t('no_api_title')}</strong> — {t('no_api_body')}</div>
        </div>
      )}

      {/* ── Modals ── */}
      {pendingQuiz && !activeQuiz && <QuizNotif key={quizKey} quiz={pendingQuiz} onJoin={handleJoin} onSkip={handleSkip} />}
      {activeQuiz  && <QuizModal quiz={activeQuiz} onAnswer={wrappedHandleQuizAnswer} onExpire={handleQuizExpire} onClose={handleCloseActiveQuiz} />}

      {showMarket && (
        <MarketModal
          myCollection={gs.collection} market={gs.market} gold={gs.gold} cardPool={gs.cardPool}
          myListings={gs.myListings} transactions={gs.transactions}
          onClose={() => { setShowMarket(false); setMarketTab('acheter'); setSelectedCard(null); }}
          onBuy={handleBuy} onListCard={handleListCard} onCancelListing={handleCancelListing} onCancelAllListings={handleCancelAllListings}
          initialTab={marketTab} initialSellCard={marketTab === 'vendre' ? selectedCard : null}
          ranks={gs.limits.playerRanks}
          marketSalesOpen={gs.limits.marketSalesOpen !== false}
          myPseudo={auth.profile?.pseudo}
          unreadSales={gs.unreadSales}
          onClearUnreadSales={() => gs.setUnreadSales(0)}
          onClearNewTransactions={gs.clearNewTransactions}
        />
      )}
      {welcomeCards.length > 0 && (
        <OfferedCardModal
          card={welcomeCards[0]}
          remaining={welcomeCards.length}
          lang={lang}
          t={t}
          onDismiss={() => {
            const next = welcomeCards.slice(1)
            setWelcomeCards(next)
            if (next.length === 0 && !auth.profile?.welcome_given) {
              setTimeout(() => setShowTour(true), 300)
            }
          }}
        />
      )}
      {showTour && auth.profile && <OnboardingTour onDone={async () => {
        setShowTour(false)
        const { apiOnboardingDone } = await import('./services/api.js')
        await apiOnboardingDone()
        auth.setProfile(p => p ? { ...p, welcome_given: true } : p)
      }} />}

      {/* ── Prompt inscription — bloque la réponse au quiz pour les invités ── */}
      {showRegisterPrompt && !auth.profile && (
        <div style={{ position: 'fixed', inset: 0, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, backdropFilter: 'blur(10px)', padding: 20 }}>
          <div style={{ background: 'linear-gradient(145deg,#1a1a2e,#16213e)', borderRadius: 24, padding: '32px 28px', width: 'min(94vw,400px)', border: '1.5px solid #6c5ce744', boxShadow: '0 32px 80px #000b', fontFamily: "'Nunito',sans-serif", textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#f9ca24', marginBottom: 8 }}>
              {t('register_prompt_title')}
            </div>
            <div style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 20 }}>
              {t('register_prompt_body')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setShowRegisterPrompt(false); setShowAuth(true); }}
                style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                {t('register_prompt_cta')}
              </button>
              <button onClick={() => { setShowRegisterPrompt(false); }}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                {t('register_prompt_skip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bannière déblocage marché ── */}
      {false && marketUnlockBanner && !auth.profile && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 2500, width: 'min(96vw,500px)', background: 'linear-gradient(135deg,#0d2b1a,#0f3d1f)', border: '1.5px solid #00b89466', borderRadius: 18, boxShadow: '0 12px 40px #000b', fontFamily: "'Nunito',sans-serif", overflow: 'hidden', animation: 'slideUp .4s cubic-bezier(.34,1.56,.64,1) both' }}>
          <div style={{ background: 'linear-gradient(90deg,#00b894,#00cec9)', height: 3 }}/>
          <div style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 36, flexShrink: 0 }}>🏪</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, color: '#00b894', fontSize: 14, marginBottom: 4 }}>{t('market_unlock_title')}</div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{t('market_unlock_body')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setMarketUnlockBanner(false); setShowMarket(true); }}
                style={{ background: 'linear-gradient(135deg,#00b894,#00cec9)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t('market_unlock_sell')}
              </button>
              <button onClick={() => setMarketUnlockBanner(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: 10, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                {t('market_unlock_later')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          count={gs.collection[selectedCard.id] || 0}
          onClose={() => setSelectedCard(null)}
          onSell={() => { setSelectedCard(null); setMarketTab('vendre'); setShowMarket(true); }}
        />
      )}
      {showLeaderboard && <LeaderboardModal myCollection={gs.collection} myPseudo={auth.profile?.pseudo} myId={auth.profile?.id} cardPool={gs.cardPool} ranks={gs.limits.playerRanks} onClose={() => setShowLeaderboard(false)} />}
      {showAuth        && <AuthModal auth={auth} onClose={() => setShowAuth(false)} onSuccess={handleLoginSuccess} />}
      {showChoosePseudo && <AuthModal auth={auth} initialMode="choose_pseudo" onClose={() => setShowChoosePseudo(false)} onSuccess={() => setShowChoosePseudo(false)} />}
      {showSettings && auth.profile && <SettingsModal auth={auth} collection={gs.collection} cardPool={gs.cardPool} unlockedAch={gs.unlockedAch} ranks={gs.limits.playerRanks} score={userScore} onStartTour={() => { setShowSettings(false); setShowTour(true) }} onClose={() => setShowSettings(false)} />}
      {showShop && <ShopModal onClose={() => setShowShop(false)} cardPool={gs.cardPool} onPurchase={handlePurchase} />}
      {showAdmin && (
        <AdminPanel
          cardPool={gs.cardPool} cardTypes={gs.cardTypes} questions={questions} limits={gs.limits}
          maintenanceMode={gs.maintenance.on} maintenanceText={gs.maintenance.text}
          bannedIPs={gs.bannedIPs}
          onClose={() => setShowAdmin(false)}
          onAddCard={gs.adminAddCard} onEditCard={gs.adminEditCard} onDeleteCard={gs.adminDeleteCard}
          onAddType={gs.adminAddType} onDeleteType={gs.adminDeleteType} onRenameType={gs.adminRenameType}
          onAddQuestion={async q => {
            if (q.id) { // déjà persisté (vient du batch import)
              setQuestions(prev => [...prev, q])
              return
            }
            const { data, error } = await apiAdminAddQuestion(q.q, q.a, q.translations)
            if (!error && data?.question) {
              const saved = data.question
              setQuestions(prev => [...prev, { id: saved.id, q: saved.question, a: saved.answer, hint: saved.hint || '', active: saved.active, translations: saved.translations || {} }])
            }
          }}
          onReplaceQuestions={list => setQuestions(list)}
          onEditQuestion={q => setQuestions(prev => prev.map(x => x.id === q.id ? q : x))}
          onDeleteQuestion={id => setQuestions(prev => prev.map(x => x.id === id ? { ...x, active: false } : x))}
          onToggleQuestion={async id => {
            const q = questions.find(x => x.id === id)
            if (!q) return
            const newActive = q.active === false
            setQuestions(prev => prev.map(x => x.id === id ? { ...x, active: newActive } : x))
            if (import.meta.env.VITE_API_URL) {
              apiAdminToggleQuestion(id, newActive).catch(() => {
                // rollback si erreur
                setQuestions(prev => prev.map(x => x.id === id ? { ...x, active: !newActive } : x))
              })
            }
          }}
          onSetLimits={async (limEdit) => {
            const prevLimits = gs.limits;
            gs.setLimits(limEdit)
            try {
              await Promise.all([
                apiSetConfig('limits_connected', limEdit.connected),
                apiSetConfig('quiz_interval',    limEdit.quizInterval ?? 60),
                apiSetConfig('quiz_rarity_rates',  limEdit.quizRarityRates   ?? DEFAULT_RARITY_RATES),
                ...(limEdit.cache_ttl_cards       != null ? [apiSetConfig('cache_ttl_cards',       limEdit.cache_ttl_cards)]       : []),
                ...(limEdit.cache_ttl_config      != null ? [apiSetConfig('cache_ttl_config',      limEdit.cache_ttl_config)]      : []),
                ...(limEdit.cache_ttl_leaderboard != null ? [apiSetConfig('cache_ttl_leaderboard', limEdit.cache_ttl_leaderboard)] : []),
                ...(limEdit.cache_ttl_market      != null ? [apiSetConfig('cache_ttl_market',      limEdit.cache_ttl_market)]      : []),
                ...(limEdit.cache_ttl_quiz_stats  != null ? [apiSetConfig('cache_ttl_quiz_stats',  limEdit.cache_ttl_quiz_stats)]  : []),
                apiSetConfig('player_ranks',       limEdit.playerRanks    ?? DEFAULT_RANKS),
                apiSetConfig('market_sales_open',   limEdit.marketSalesOpen   ?? true),
                apiSetConfig('max_active_listings', limEdit.maxActiveListings ?? 10),
                apiSetConfig('bots_visible',        limEdit.botsVisible       ?? false),
                apiSetConfig('support_visible',     limEdit.supportVisible    ?? true),
                apiSetConfig('leaderboard_visible', limEdit.leaderboardVisible?? true),
                apiSetConfig('market_expire_days',  limEdit.marketExpireDays  ?? 30),
                ...(limEdit.typeTranslations != null ? [apiSetConfig('type_translations', limEdit.typeTranslations)] : []),
                ...(limEdit.registrationWhitelist != null ? [apiSetConfig('registration_whitelist', limEdit.registrationWhitelist)] : []),
              ])
            } catch (err) {
              gs.setLimits(prevLimits)
            }
          }}
      onSetMaintenance={async (on, text) => {
            const prevM = gs.maintenance;
        gs.setMaintenance({ on, text })
            try {
              await apiSetConfig('maintenance', on)
              await apiSetConfig('maintenance_text', text)
            } catch (err) {
              gs.setMaintenance(prevM)
            }
      }}
          onBanIP={gs.adminBanIP} onUnbanIP={gs.adminUnbanIP}
          onUpdateCardInPool={card => gs.setCardPool(prev => prev.map(c => c.id === card.id ? {...c, ...card, desc: card.desc??card.description??''} : c))}
          onStartTour={() => { setShowAdmin(false); setShowTour(true) }}
          onTestAchievement={card => setWelcomeCards(prev => [...prev, card])}
        />
      )}

      {/* ── Scroll to Top Button ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 2500, background: 'linear-gradient(135deg,#1a1a2e,#16213e)', border: '1.5px solid #6c5ce788', color: '#a29bfe', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 8px 32px #0008', transition: 'all .2s ease', fontFamily: "'Nunito',sans-serif" }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px #000c'; e.currentTarget.style.borderColor = '#a29bfe'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px #0008'; e.currentTarget.style.borderColor = '#6c5ce788'; e.currentTarget.style.color = '#a29bfe' }}
          title="Remonter en haut"
        >
          ↑
        </button>
      )}
    </div>
  );
}
