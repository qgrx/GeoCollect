import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext.jsx';

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
import { apiSetConfig, apiGetCurrentQuiz, apiAdminToggleQuestion, apiGetQuizHistory, apiAdminGetQuestions, apiAdminAddQuestion, apiGetDailyTreasure, apiClaimDailyTreasure, apiGetCurrentSeason, apiMarkSeasonSeen } from './services/api.js'
import { soundQuizNew, soundMarketSale } from './utils/sounds.js'
import { getSocket, disconnectSocket } from './services/socket.js'
import { useAuth } from './hooks/useAuth.js';

// ─── Components ───────────────────────────────────────────────────────────────
import Card from './components/Card.jsx';
import CardDetailModal from './components/CardDetailModal.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import PseudoDisplay from './components/PseudoDisplay.jsx';
import { getRank, isTopRank, rankCC } from './utils/rankUtils.js';
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
import ForgeModal  from './features/forge/ForgeModal.jsx'
import TresorPage  from './features/treasures/TresorPage.jsx';
import SeasonPopup  from './components/SeasonPopup.jsx';
import DocsLayout   from './features/docs/DocsLayout.jsx';

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
            <div style={{ fontSize:11, fontWeight:900, color:'#fff', textTransform:'uppercase', letterSpacing:1 }}>{t('onboarding_card_title')}</div>
            {remaining > 1 && <div style={{ fontSize:10, color:'#ffffffaa' }}>{t('onboarding_card_remaining').replace('{n}', remaining)}</div>}
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
            {isLast ? t('onboarding_card_receive_last') : t('onboarding_card_receive')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Écran de choix de pseudo (onboarding étape 1) ───────────────────────────
function OnboardingPseudoScreen({ auth, t, onDone }) {
  const [pseudo, setPseudo] = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit() {
    const p = pseudo.trim()
    if (p.length < 3)  { setError(t('auth_pseudo_short') || 'Minimum 3 caractères'); return }
    if (p.length > 20) { setError(t('onboarding_pseudo_max')); return }
    setBusy(true); setError('')
    const { error: e } = await auth.updatePseudo(p)
    setBusy(false)
    if (e) { setError(e.message === 'pseudo_taken' ? (t('auth_pseudo_taken') || 'Pseudo déjà pris') : e.message); return }
    onDone()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0f0f1e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.92) translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ width:'min(92vw,400px)', background:'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius:24, padding:'32px 28px', border:'1.5px solid #ffffff14', boxShadow:'0 24px 80px #000c', animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🗺️</div>
          <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:26, color:'#f9ca24', marginBottom:6 }}>{t('onboarding_welcome')}</div>
          <div style={{ fontSize:14, color:'#aaa', lineHeight:1.5 }}>{t('onboarding_pseudo_sub')}</div>
        </div>
        <input
          autoFocus
          value={pseudo}
          onChange={e => { setPseudo(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && !busy && handleSubmit()}
          placeholder={t('onboarding_pseudo_placeholder')}
          maxLength={20}
          style={{ width:'100%', boxSizing:'border-box', background:'#ffffff0f', border:`1.5px solid ${error ? '#e74c3c' : '#ffffff22'}`, borderRadius:12, color:'#fff', padding:'13px 16px', fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:16, outline:'none', marginBottom:error ? 8 : 16, transition:'border-color .2s' }}
        />
        {error && <div style={{ color:'#e74c3c', fontSize:12, fontWeight:700, marginBottom:12 }}>{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={busy || pseudo.trim().length < 3}
          style={{ width:'100%', background: busy || pseudo.trim().length < 3 ? '#ffffff18' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border:'none', color: busy || pseudo.trim().length < 3 ? '#666' : '#fff', padding:'14px', borderRadius:12, fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:16, cursor: busy || pseudo.trim().length < 3 ? 'default' : 'pointer', transition:'all .2s' }}
        >
          {busy ? '…' : t('onboarding_pseudo_btn')}
        </button>
        <div style={{ textAlign:'center', fontSize:10, color:'#444', marginTop:10 }}>{t('onboarding_pseudo_hint')}</div>
      </div>
    </div>
  )
}

export default function App() {
  const { t, lang } = useT();
  const { theme, mode, toggle } = useTheme();

  // ── Game state (all logic lives in the hook) ───────────────────────────────
  const auth = useAuth()
  const gs   = useGameState(auth, {
    onAchievementCard: (card) => setWelcomeCards(prev => [...prev, card])
  });

  const cardPoolRef = useRef(gs.cardPool);
  useEffect(() => { cardPoolRef.current = gs.cardPool }, [gs.cardPool]);

  // ── Confirmation email uniquement — le SDK Supabase nettoie lui-même l'URL OAuth ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')
    if (type === 'signup') {
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

      // Calcul du countdown à partir de next_quiz_at (nouvelle API)
      // On calcule la durée restante côté serveur et on l'ajoute au temps local
      // pour éviter tout décalage d'horloge client/serveur.
      if (data.next_quiz_at && !data.quiz) {
        const nextAt    = new Date(data.next_quiz_at).getTime()
        const serverNow = data.server_time ? new Date(data.server_time).getTime() : Date.now()
        const msLeft    = Math.max(0, nextAt - serverNow)
        setNextQuizTime(Date.now() + msLeft)
        setQuizIsShiny(data.next_is_shiny || false)
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
        setQuizIsShiny(data.quiz.is_shiny || false)
        setQuizSessionActive(true)
      }
    }).catch(() => {})

    getSocket().then(s => {
      if (!s) return  // API non configurée
      socket = s

      // Quiz — nouveau quiz disponible
      s.on('quiz:new', (data) => {
        const poolCard = cardPoolRef.current?.find(c => c.id === data.card?.id) || {}
        // poolCard (pool complet) override data.card (minimal) — image_url présent dans les deux maintenant
        const card = { ...data.card, ...poolCard, sellable: true, minPrice: null, desc: poolCard.desc ?? poolCard.description ?? '' }
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
        setQuizIsShiny(data.is_shiny || false)
        setLostToWinner(null)

        // Activation immédiate — synchronisation serveur.
        // server_time corrige le décalage d'horloge client/serveur.
        const serverNow = data.server_time ? new Date(data.server_time).getTime() : Date.now()
        const clockSkew  = Date.now() - serverNow
        setNextQuizTime(Date.now() + (data.next_quiz_in ?? 60) * 1000 - clockSkew)
        setActiveQuiz(null)
        activeQuizRef.current = null
        setQuizKey(k => k + 1)
        setQuizSessionActive(true)
        if (Date.now() >= snoozedUntilRef.current) {
          setPendingQuiz(q)
          soundQuizNew()
        }
        sendPushNotif(card)
      })

      // Quiz — résolu par quelqu'un
      s.on('quiz:solved', (data) => {
        // Sécurité : ignorer si l'événement WebSocket contient des attributs de transaction (bug backend)
        if (data.price !== undefined || data.buyer !== undefined || data.type === 'vente' || data.type === 'achat') return

        setQuizSessionActive(false)

        // Mettre à jour le prochain quiz dès quiz:solved (sans attendre quiz:new)
        if (data.next_quiz_at && data.server_time) {
          const nextAt    = new Date(data.next_quiz_at).getTime()
          const serverNow = new Date(data.server_time).getTime()
          const msLeft    = Math.max(0, nextAt - serverNow)
          setNextQuizTime(Date.now() + msLeft)
        }
        setQuizIsShiny(data.next_is_shiny || false)

        const iSelf = data.winner && data.winner === auth.profile?.pseudo

        if (!iSelf) {
          handleQuizExpireRef.current(data.winner, data.is_bot)
        }

        // Mettre à jour l'historique uniquement si ce n'est pas le joueur lui-même
        // (handleQuizAnswer ajoute déjà l'entrée { winner: 'Moi' } côté gagnant)
        if (data.winner && !iSelf) {
          const fullCard = cardPoolRef.current?.find(c => c.name === data.card_name)
            || { name: data.card_name, rarity: data.rarity, type: 'Normal', id: 0 }
          setHistory(h => {
            if (h[0]?.winner === data.winner && h[0]?.card?.name === data.card_name) return h
            return [{ card: fullCard, winner: data.winner, won: false, isBot: data.is_bot || false, isShiny: data.is_shiny || false }, ...h].slice(0, 10)
          })
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

  // ── Écran de chargement initial : minimum 3s + fondu sortant ───────────────
  const [loaderVisible, setLoaderVisible] = useState(true)
  const [loaderFading,  setLoaderFading]  = useState(false)
  const [minTimeDone,   setMinTimeDone]   = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinTimeDone(true), 3000)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!auth.loading && minTimeDone && loaderVisible && !loaderFading) {
      setLoaderFading(true)
      setTimeout(() => setLoaderVisible(false), 500)
    }
  }, [auth.loading, minTimeDone, loaderVisible, loaderFading])

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [quizIsShiny,     setQuizIsShiny]     = useState(false);
  const [showMarket,      setShowMarket]      = useState(false);
  const [showForge,       setShowForge]       = useState(false);
  const [marketTab,       setMarketTab]       = useState('acheter');
  const [marketSellCard,  setMarketSellCard]  = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);
  const docsPath = ['/support', '/faq', '/release-notes']
  const [showDocs, setShowDocs] = useState(() => docsPath.includes(window.location.pathname))
  const [docsPage, setDocsPage] = useState(() => {
    const p = window.location.pathname
    if (p === '/faq') return 'faq'
    if (p === '/release-notes') return 'release-notes'
    return 'support'
  })
  const [showAuth,        setShowAuth]        = useState(false);
  const [showChoosePseudo, setShowChoosePseudo] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showShop,        setShowShop]        = useState(false);
  const [shopPackId,      setShopPackId]       = useState(null);
  const [revealCards,     setRevealCards]      = useState(null);
  const [revealGold,      setRevealGold]       = useState(0);
  const [revealPayment,   setRevealPayment]    = useState('');
  const [showTxHistory,   setShowTxHistory]   = useState(false);
  const [filter,          setFilter]          = useState('Tous');
  const [showMissing,     setShowMissing]     = useState(false);
  const [showShiny,       setShowShiny]       = useState(false);
  const [sortBy,          setSortBy]          = useState('rarity'); // 'rarity'|'name-asc'|'name-desc'
  const [sortMenuOpen,    setSortMenuOpen]    = useState(false);
  const [gridAnimKey,     setGridAnimKey]     = useState(0);
  const [cardSearch,      setCardSearch]      = useState('');
  const [collPage,        setCollPage]        = useState(0);
  const [quizSessionActive, setQuizSessionActive] = useState(false);
  const [dailyOffer, setDailyOffer] = useState(null);
  const [seasonPopup, setSeasonPopup] = useState(null); // { season, cards }
  const COLL_PAGE_SIZE = 24;
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [selectedCard,    setSelectedCard]    = useState(null);
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [selectedCardIsShiny,      setSelectedCardIsShiny]      = useState(false);
  const [selectedCardFromHistory,  setSelectedCardFromHistory]  = useState(false);
  const [hasReleaseNotif,          setHasReleaseNotif]          = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const avatarMenuRef = useRef(null);
  const [welcomeCards, setWelcomeCards] = useState([]);
  // Onboarding : null | 'pseudo' | 'gift' | 'card' | 'tour'
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [onboardingCardReady, setOnboardingCardReady] = useState(false);
  const [marketUnlockBanner, setMarketUnlockBanner] = useState(false);
  const [toast,           setToast]           = useState(null);
  const [socketOnline,    setSocketOnline]    = useState(true);
  const [goldFlash,       setGoldFlash]       = useState(null);

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

  // ── Détection mobile / desktop ────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const [isWide,   setIsWide]   = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640)
  useEffect(() => {
    const handler = () => {
      const wide = window.innerWidth >= 640
      setIsMobile(!wide)
      setIsWide(wide)
      if (wide) setActiveTab(t => t === 'home' ? 'collection' : t)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Navigation mobile (onglets) ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('geocoins_tab')
    const wide  = typeof window !== 'undefined' && window.innerWidth >= 640
    return saved || (wide ? 'collection' : 'home')
  })
  useEffect(() => { localStorage.setItem('geocoins_tab', activeTab) }, [activeTab])
  useEffect(() => { gs.marketOpenRef.current = activeTab === 'market' }, [activeTab])

  // Fetch offre du jour quand le profil est chargé ou quand on ouvre l'onglet Trésors
  useEffect(() => {
    if (!auth.profile) return
    apiGetDailyTreasure().then(({ data }) => { if (data) setDailyOffer(data) })
  }, [auth.profile?.id, activeTab === 'tresors'])

  // Vérifier la saison en cours à la connexion — afficher la popup si nouvelle saison
  useEffect(() => {
    if (!auth.profile) return
    apiGetCurrentSeason().then(({ data }) => {
      if (data?.season && data.is_new) setSeasonPopup({ season: data.season, cards: data.cards || [] })
    }).catch(() => {})
  }, [auth.profile?.id])

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
    lostToWinner, setLostToWinner,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz, handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz } = quiz

  // Ref pour éviter la capture stale de handleQuizExpire dans les handlers socket
  const handleQuizExpireRef = useRef(handleQuizExpire)
  useEffect(() => { handleQuizExpireRef.current = handleQuizExpire }, [handleQuizExpire])

  // Notification release notes
  useEffect(() => {
    const publishedAt = gs.limits.releaseNotesPublishedAt?.at
    if (!publishedAt) return
    const seenAt = localStorage.getItem('geocoins_rn_seen')
    setHasReleaseNotif(!seenAt || new Date(publishedAt) > new Date(seenAt))
  }, [gs.limits.releaseNotesPublishedAt])

  function clearReleaseNotif() {
    localStorage.setItem('geocoins_rn_seen', new Date().toISOString())
    setHasReleaseNotif(false)
  }

  // Titre fixe — le favicon (pin vert) est affiché dans l'onglet par index.html
  useEffect(() => { document.title = 'Geocoins' }, [])


  // ── Bloquer le scroll du fond quand un modal est ouvert (mobile) ────────────
  useEffect(() => {
    const anyOpen = showAuth || showSettings || showAdmin || showMarket || showForge ||
      showLeaderboard || showShop || showTxHistory || showDocs || !!selectedCard ||
      showScoreDetail || !!seasonPopup || !!activeQuiz
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    document.body.style.touchAction = anyOpen ? 'none' : ''
    return () => { document.body.style.overflow = ''; document.body.style.touchAction = '' }
  }, [showAuth, showSettings, showAdmin, showMarket, showForge, showLeaderboard,
      showShop, showTxHistory, showDocs, selectedCard, showScoreDetail, seasonPopup, activeQuiz])

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
  // ── Réclamer la carte du jour ────────────────────────────────────────────────
  async function handleClaimDaily() {
    const { data, error } = await apiClaimDailyTreasure()
    if (error) throw new Error(error)
    setDailyOffer(d => d ? { ...d, claimed: true } : d)
    gs.earnCard(data.card, false)
    showToast(t('toast_daily_claimed').replace('{card}', data.card.name))
  }

  // Wrapper — bloque la soumission pour les non-connectés et propose l'inscription
  const wrappedHandleQuizAnswer = async (_userAnswer, _turnstileToken) => {
    if (!auth.profile) {
      setShowRegisterPrompt(true)
      return false
    }
    return handleQuizAnswer(_userAnswer, _turnstileToken)
  }

  async function handlePurchase(cards, gold = 0) {
    // Les cartes sont déjà sauvegardées en DB par le backend (completePurchase).
    // On met à jour l'état local et on rafraîchit la collection depuis l'API.
    cards.forEach(card => gs.earnCard(card))
    if (gold > 0) earnGoldWithFx(gold)
    showToast(t('toast_pack_added'))
    // Resynchroniser collection + profil depuis la DB
    if (auth.profile && import.meta.env.VITE_API_URL) {
      const { apiGetCollection, apiGetProfile } = await import('./services/api.js').catch(() => ({}))
      apiGetCollection?.().then(({ data }) => {
        if (data?.collection) gs.setCollection(data.collection)
        if (data?.shiny_collection) gs.setShinyCollection(data.shiny_collection)
      }).catch(() => {})
      apiGetProfile?.().then(({ data }) => {
        if (data?.profile) auth.setProfile(data.profile)
      }).catch(() => {})
    }
  }
  // Called by AuthModal after successful login
  function handleLoginSuccess(profile) {
    showToast(t('toast_welcome').replace('{pseudo}', profile?.pseudo || ''))
  }

  // ── Onboarding (nouvel utilisateur) ─────────────────────────────────────────
  useEffect(() => {
    if (!auth.profile || !import.meta.env.VITE_API_URL) return
    if (auth.profile.welcome_given) {
      // Utilisateur existant : juste vérifier le pseudo OAuth si besoin
      const providers = auth.user?.app_metadata?.providers || []
      const isOAuth = providers.includes('google') || providers.includes('github')
      if (isOAuth) {
        const p = auth.profile.pseudo || ''
        if (p.includes(' ') || p.includes('@') || p.includes('.')) setShowChoosePseudo(true)
      }
      return
    }
    // Nouvel utilisateur : toujours commencer par le choix du pseudo
    if (onboardingStep !== null) return
    setOnboardingStep('pseudo')
  }, [auth.profile?.id])

  // Étape 'gift' : récupérer la carte de bienvenue + horodatage d'entrée
  const giftEnteredAtRef = useRef(0)
  useEffect(() => {
    if (onboardingStep !== 'gift') return
    giftEnteredAtRef.current = Date.now()
    let cancelled = false
    const run = async () => {
      const { apiWelcomeCard } = await import('./services/api.js')
      const { data } = await apiWelcomeCard()
      if (cancelled) return
      const newCards = data?.cards || []
      if (newCards.length > 0) {
        newCards.forEach(c => gs.setCollection(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 })))
        setWelcomeCards(newCards)
      }
      setOnboardingCardReady(true)
    }
    run()
    return () => { cancelled = true }
  }, [onboardingStep])

  // Avancer de 'gift' → 'card'|'tour' : attend carte + données + 2s minimum d'animation
  useEffect(() => {
    if (onboardingStep !== 'gift') return
    if (!onboardingCardReady || gs.loadingData || !gs.cardPool.length) return
    const elapsed = Date.now() - giftEnteredAtRef.current
    const wait = Math.max(0, 2000 - elapsed)
    const timer = setTimeout(() => {
      setOnboardingStep(welcomeCards.length > 0 ? 'card' : 'tour')
    }, wait)
    return () => clearTimeout(timer)
  }, [onboardingStep, onboardingCardReady, gs.loadingData, gs.cardPool.length, welcomeCards.length])

  // ── Raccourcis clavier globaux ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        if (selectedCard)       { setSelectedCard(null); return }
        if (['market','forge','top'].includes(activeTab)) { setActiveTab('collection'); return }
        if (showSettings)       { setShowSettings(false); return }
        if (showAuth)           { setShowAuth(false); return }
        if (showTxHistory)      { setShowTxHistory(false); return }
        if (showAdmin)          { setShowAdmin(false); return }
        if (showShop)           { setShowShop(false); return }
        if (menuOpen)           { setMenuOpen(false); return }
      }
      if (e.key === 'Enter' && pendingQuiz && !activeQuiz) { handleJoin(); return }
      if (e.key === 'm' && !e.ctrlKey) { setActiveTab(t => t === 'market' ? 'collection' : 'market'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCard, activeTab, showSettings, showAuth,
      showTxHistory, showAdmin, showShop, menuOpen, pendingQuiz, activeQuiz])


  // Bannière déblocage marché — seulement pour les non-connectés au premier doublon
  const hasDuplicate = useMemo(
    () => Object.values(gs.collection).some(n => n > 1),
    [gs.collection]
  )
  const userScore = useMemo(
    () => collScore(gs.collection, gs.cardPool, gs.shinyCollection || {}, gs.limits.scoreRules, gs.limits.shinyMultiplier ?? 2),
    [gs.collection, gs.cardPool, gs.shinyCollection, gs.limits.scoreRules, gs.limits.shinyMultiplier]
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

    // Fonction de tri appliquée en fin
    const sortFn = sortBy === 'name-asc'
      ? (a, b) => (a.card?.name || '').localeCompare(b.card?.name || '')
      : sortBy === 'name-desc'
      ? (a, b) => (b.card?.name || '').localeCompare(a.card?.name || '')
      : (a, b) => (RARITY_CONFIG[a.card?.rarity]?.order ?? 99) - (RARITY_CONFIG[b.card?.rarity]?.order ?? 99)

    // ── Mode Shiny uniquement ─────────────────────────────────────────────────
    if (showShiny) {
      const shinyList = Object.entries(gs.shinyCollection || {})
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ card: gs.cardPool.find(c => c.id === +id), count: n, isShiny: true, missing: false }))
        .filter(x => x.card && (af || x.card.type === filter) && matchSearch(x.card))
      // Si showMissing actif en mode shiny : montrer aussi les cartes possédées sans shiny
      if (showMissing) {
        const shinyIds = new Set(shinyList.map(x => x.card.id))
        const nonShiny = Object.entries(gs.collection)
          .filter(([id, v]) => v > 0 && !shinyIds.has(+id))
          .map(([id]) => ({ card: gs.cardPool.find(c => c.id === +id), count: 0, isShiny: false, missing: true }))
          .filter(x => x.card && (af || x.card.type === filter) && matchSearch(x.card))
        return [...shinyList, ...nonShiny].sort(sortFn)
      }
      return shinyList.sort(sortFn)
    }

    // ── Mode normal (existant) ───────────────────────────────────────────────
    let normalList;
    if (showMissing) {
      normalList = gs.cardPool
        .filter(c => (af || c.type === filter) && matchSearch(c))
        .map(c => ({ card: c, count: gs.collection[c.id] || 0, missing: !(gs.collection[c.id] > 0) }))
    } else {
      normalList = Object.entries(gs.collection)
        .filter(([, v]) => v > 0)
        .map(([id, cnt]) => ({ card: gs.cardPool.find(c => c.id === +id), cnt, missing: false }))
        .filter(x => x.card && (af || x.card.type === filter) && matchSearch(x.card))
    }
    const shinyMap = {}
    Object.entries(gs.shinyCollection || {}).forEach(([id, n]) => { if (n > 0) shinyMap[+id] = n })
    const result = []
    const shinyInserted = new Set()
    for (const entry of normalList) {
      result.push(entry)
      const sid = entry.card?.id
      if (sid && shinyMap[sid] && !shinyInserted.has(sid)) {
        const card = entry.card
        if ((af || card.type === filter) && matchSearch(card)) {
          result.push({ card, count: shinyMap[sid], isShiny: true, missing: false })
          shinyInserted.add(sid)
        }
      }
    }
    Object.entries(shinyMap).forEach(([id, n]) => {
      if (shinyInserted.has(+id)) return
      const card = gs.cardPool.find(c => c.id === +id)
      if (!card || !(af || card.type === filter) || !matchSearch(card)) return
      result.push({ card, count: n, isShiny: true, missing: false })
    })
    return result.sort(sortFn)
  }, [showMissing, showShiny, sortBy, filter, cardSearch, gs.collection, gs.cardPool, gs.shinyCollection]);

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

  // SPA : chemins valides
  const validPaths = ['/', '/support', '/faq', '/release-notes']
  if (!validPaths.includes(window.location.pathname) && !window.location.hash.includes('access_token')) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito',sans-serif", color: '#fff', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 72 }}>🗺️</div>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 48, color: theme.gold }}>404</div>
        <div style={{ color: '#888', fontSize: 16 }}>Cette page n'existe pas.</div>
        <button onClick={() => window.location.href = '/'} style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
          Retour à l'accueil
        </button>
      </div>
    )
  }

  // ── Écrans d'onboarding (bloquent l'accès au site) ──────────────────────────
  if (auth.profile && onboardingStep === 'pseudo') {
    return <OnboardingPseudoScreen auth={auth} t={t} onDone={() => { setOnboardingCardReady(false); setOnboardingStep('gift') }} />
  }

  if (auth.profile && onboardingStep === 'gift') {
    return (
      <div style={{ minHeight:'100vh', background:'#0f0f1e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, fontFamily:"'Nunito',sans-serif" }}>
        <style>{`@keyframes floatGift{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-14px) rotate(3deg)}} @keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-8px);opacity:1}}`}</style>
        <div style={{ fontSize:72, animation:'floatGift 2s ease-in-out infinite' }}>🎁</div>
        <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:22, color:'#f9ca24', textAlign:'center' }}>{t('onboarding_gift')}</div>
        <div style={{ display:'flex', gap:10 }}>
          {[0, 0.25, 0.5].map(d => <div key={d} style={{ width:9, height:9, borderRadius:'50%', background:'#f9ca24', animation:`dotBounce 0.9s ${d}s ease-in-out infinite` }}/>)}
        </div>
      </div>
    )
  }

  if (loaderVisible) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, fontFamily: "'Nunito',sans-serif", transition: 'opacity .5s ease', opacity: loaderFading ? 0 : 1, pointerEvents: loaderFading ? 'none' : 'auto' }}>
      <style>{`@keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-9px);opacity:1}}`}</style>
      <Logo iconSize={34} textSize={22} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 0.2, 0.4].map(d => (
          <div key={d} style={{ width: 9, height: 9, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Nunito', sans-serif", color: theme.textPrimary, background: theme.bgMain, display: 'flex', flexDirection: 'column', paddingBottom: (auth.profile && isMobile) ? 68 : 0 }}>
      {gs.loadingData && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, background: 'linear-gradient(90deg,#74c7ec,#f9ca24,#e17055,#74c7ec)', backgroundSize: '300% 100%', animation: 'shimmer 1.2s linear infinite' }} />}
      <style>{`
        @keyframes pulseBadge { 0%{transform:scale(1);box-shadow:0 0 0 0 rgba(231,76,60,.7)}70%{transform:scale(1.15);box-shadow:0 0 0 5px rgba(231,76,60,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(231,76,60,0)} }
        @keyframes slideIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes goldPop   { 0%{opacity:1;transform:translate(-50%,-50%) scale(.8)} 60%{opacity:1;transform:translate(-50%,-80%) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-120%) scale(1)} }
        @keyframes toastIn   { from{opacity:0;transform:translateY(12px) scale(.97)} to{opacity:1;transform:none} }
        @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes dotBounce { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-8px);opacity:1} }
        @keyframes slideFromRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardSort { 0%{opacity:0;transform:scale(.88) translateY(6px)} 60%{transform:scale(1.03) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeLeft { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ACCENT BAR */}
      <div style={{ height: 3, background: 'linear-gradient(90deg,#58a6ff,#bc8cff,#f9ca24,#f85149)', flexShrink: 0 }} />

      {/* ── HEADER ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 200, background: theme.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${theme.border}`, padding: isMobile ? '9px 14px' : '9px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Logo iconSize={isMobile ? 26 : 30} textSize={isMobile ? 15 : 19} />

        {/* Desktop tab nav — même style que mobile, centré dans le header */}
        {isWide && auth.profile ? (
          <>
            <div style={{ flex: 1 }} />
            <nav style={{ display: 'flex' }}>
              {[
                { id: 'tresors',    icon: '💎', label: t('nav_tresors'), badge: dailyOffer && !dailyOffer.claimed ? 1 : 0 },
                { id: 'collection', icon: '🃏', label: t('nav_collection'), tour: 'nav-collection' },
                { id: 'market',     icon: '🏪', label: t('nav_market'), badge: gs.unreadSales, tour: 'nav-market' },
                ...(gs.cardPool.some(c => c.forgeable) || gs.limits.shinyForgeOpen !== false ? [{ id: 'forge', icon: '🔨', label: t('nav_forge'), tour: 'nav-forge' }] : []),
                { id: 'top',        icon: '🏆', label: t('nav_top'), tour: 'nav-top' },
              ].map(tb => {
                const active = activeTab === tb.id
                return (
                  <button key={tb.id} onClick={() => setActiveTab(tb.id)}
                    data-tour={tb.tour}
                    style={{ position: 'relative', background: 'none', border: 'none', color: active ? '#f9ca24' : theme.headerMuted, padding: '6px 18px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontFamily: "'Nunito',sans-serif", transition: 'color .15s' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{tb.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .3 }}>{tb.label}</span>
                    {tb.badge > 0 && <span style={{ position: 'absolute', top: 4, left: '55%', background: '#e74c3c', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.badgeBorder}` }}>{tb.badge > 9 ? '9+' : tb.badge}</span>}
                    {active && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#f9ca24', borderRadius: '3px 3px 0 0' }} />}
                  </button>
                )
              })}
            </nav>
            <div style={{ flex: 1 }} />
          </>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Currencies (mobile only — desktop shows in sidebar profile) */}
        {auth.profile && isMobile && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div data-tour="gold" style={{ background: '#f9ca2410', border: '1px solid #f9ca2428', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: theme.gold }}>{gs.gold}<span style={{ fontWeight: 500, fontSize: 11, opacity: .6 }}>G</span></span>
            </div>
            {gs.forgePoints > 0 && (
              <div style={{ background: '#a29bfe10', border: '1px solid #a29bfe28', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>🔨</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#a29bfe' }}>{gs.forgePoints}</span>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle — connecté uniquement */}
        {auth.profile && <button onClick={toggle} title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={{ background: 'none', border: `1px solid ${theme.headerMuted}44`, color: theme.headerMuted, width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>}

        {/* Avatar */}
        {auth.profile ? (
          <div style={{ position: 'relative' }} ref={avatarMenuRef}>
            <button onClick={() => setAvatarMenu(v => !v)} style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: '2px solid #f9ca2444', cursor: 'pointer', fontSize: 13, fontWeight: 900, color: '#1a2538', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {auth.profile.pseudo[0].toUpperCase()}
              {gs.unreadSales > 0 && isMobile && <span style={{ position: 'absolute', top: -3, right: -3, background: '#e74c3c', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${theme.badgeBorder}`, color: '#fff' }}>{gs.unreadSales > 9 ? '9+' : gs.unreadSales}</span>}
              {hasReleaseNotif && <span style={{ position: 'absolute', top: -2, left: -2, background: '#6c5ce7', borderRadius: '50%', width: 10, height: 10, border: `1.5px solid ${theme.badgeBorder}`, boxShadow: '0 0 6px #6c5ce7' }} />}
            </button>
            {avatarMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 16px 48px #000d', zIndex: 99999, minWidth: 200, overflow: 'hidden', fontFamily: "'Nunito',sans-serif" }}>
                <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${theme.borderLight}` }}>
                  <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5, paddingLeft: 4 }}>Langue</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Object.entries(LANGS).map(([code, label]) => (
                      <button key={code} onClick={() => setLang(code)} style={{ background: lang === code ? '#f9ca2420' : theme.bgElevated, border: lang === code ? '1px solid #f9ca2444' : `1px solid ${theme.border}`, color: lang === code ? '#f9ca24' : theme.textSecondary, padding: '3px 9px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>{label}</button>
                    ))}
                  </div>
                </div>
                {[
                  { icon: '👤', label: t('menu_account') || 'Mon compte', fn: () => { setShowSettings(true); setAvatarMenu(false) } },
                  { icon: '💬', label: 'Support', notif: hasReleaseNotif, fn: () => { clearReleaseNotif(); setDocsPage('release-notes'); setShowDocs(true); setAvatarMenu(false); window.history.pushState({}, '', '/release-notes') } },
                  ...(auth.profile?.role === 'admin' ? [{ icon: '🔧', label: t('menu_admin') || 'Administration', fn: () => { setShowAdmin(true); setAvatarMenu(false) } }] : []),
                  null,
                  { icon: '↩', label: t('btn_logout'), color: '#f85149', fn: () => { auth.signOut(); setAvatarMenu(false); setHistory([]); setPendingQuiz(null); setActiveQuiz(null); } },
                ].map((item, i) => item === null ? (
                  <div key={i} style={{ height: 1, background: theme.borderLight }}/>
                ) : (
                  <button key={i} onClick={item.fn} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', color: item.color || theme.textPrimary, padding: '10px 14px', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = theme.bgElevated}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
                    {item.notif && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#6c5ce7', flexShrink: 0, boxShadow: '0 0 6px #6c5ce788' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangSelector />
            <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900 }}>{t('btn_login')}</button>
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ── */}
      {!auth.profile && import.meta.env.VITE_API_URL ? (
        <LandingSection onOpenAuth={() => setShowAuth(true)} />
      ) : (
        <div style={{ flex: 1, display: isWide ? 'flex' : 'block', alignItems: 'flex-start' }}>

          {/* LEFT SIDEBAR (desktop) / HOME TAB (mobile) */}
          {/* ── LEFT SIDEBAR content ── */}
          {(isWide || activeTab === 'home') && auth.profile && (
            <aside style={{ width: isWide ? 288 : '100%', flexShrink: 0, padding: '14px 16px', borderRight: isWide ? `1px solid ${theme.border}` : 'none', display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeLeft .35s ease-out both', ...(isWide ? { position: 'sticky', top: 53, maxHeight: 'calc(100vh - 53px)', overflowY: 'auto' } : {}) }}>

              {/* Countdown hero (mobile only — en haut) */}
              {!isWide && !activeQuiz && auth.profile?.status !== 'banni' && (
                <div data-tour="countdown">
                  <CountdownWidget secondsLeft={countdown} cycleTime={gs.limits?.quizInterval ?? QUIZ_INTERVAL} nextCard={nextCard} hasPendingQuiz={!!pendingQuiz && !lostToWinner} lostTo={lostToWinner ?? null} onJoin={handleJoin} isShiny={quizIsShiny} />
                </div>
              )}

              {/* User profile mini card — skeleton pendant le chargement */}
              {gs.loadingData ? (
                <div style={{ background: theme.overlay, borderRadius: 14, padding: '14px 16px', border: `1px solid ${theme.border}` }}>
                  {/* Avatar + pseudo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(90deg,#ffffff08,#ffffff14,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 14, width: '60%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff08,#ffffff14,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
                      <div style={{ height: 10, width: '35%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s .1s infinite' }} />
                    </div>
                  </div>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                    {[0, 0.08, 0.16].map(d => (
                      <div key={d} style={{ height: 52, borderRadius: 8, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${d}s infinite` }} />
                    ))}
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s .2s infinite' }} />
                </div>
              ) : (() => {
                const rank = getRank(userScore, gs.limits.playerRanks)
                const { c1, c2 } = rankCC(rank)
                const sortedRanks = [...(gs.limits.playerRanks || DEFAULT_RANKS)].sort((a, b) => a.min - b.min)
                const nextRank = sortedRanks.find(r => r.min > userScore)
                const prevMin = [...sortedRanks].reverse().find(r => r.min <= userScore)?.min || 0
                const pct = nextRank ? Math.round(((userScore - prevMin) / (nextRank.min - prevMin)) * 100) : 100
                const uniqueCards = Object.values(gs.collection).filter(n => n > 0).length
                return (
                  <div data-tour="profile" style={{ background: theme.overlay, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c1}66`, position: 'relative', overflow: 'hidden', animation: 'fadeUp .4s .05s ease-out both' }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${c1}14`, pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 0 14px ${c1}44`, border: `2px solid ${c1}44` }}>
                        {auth.profile.pseudo?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <PseudoDisplay pseudo={auth.profile.pseudo} score={userScore} ranks={gs.limits.playerRanks} style={{ color: theme.textPrimary }}/>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: c1 }}>{rank?.label}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                      {[
                        { icon: '🃏', value: uniqueCards,     label: t('stat_geocoins') },
                        { icon: '💰', value: gs.gold,        label: t('stat_gold') },
                        { icon: '🔨', value: gs.forgePoints,  label: t('stat_forge') },
                      ].map(({ icon, value, label }) => (
                        <div key={label} style={{ background: theme.overlayMd, borderRadius: 8, padding: '6px 2px', textAlign: 'center' }}>
                          <div style={{ fontSize: 12 }}>{icon}</div>
                          <div style={{ fontWeight: 900, fontSize: 12, color: theme.textPrimary, lineHeight: 1.2 }}>{value}</div>
                          <div style={{ fontSize: 7, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {nextRank ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: theme.textMuted }}>
                          <span>{t('rank_next')} <span style={{ background: nextRank.color, color: '#fff', fontWeight: 800, padding: '1px 6px', borderRadius: 4, fontSize: 9, textShadow: '0 1px 2px #0004' }}>{nextRank.label}</span></span>
                          <span onClick={() => setShowScoreDetail(true)} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{userScore}/{nextRank.min}</span>
                        </div>
                        <div style={{ background: theme.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }}/>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, fontWeight: 800, color: c1, textAlign: 'center' }}>{t('rank_max')}</div>
                    )}
                  </div>
                )
              })()}

              {/* Daily quests */}
              <div data-tour="quests">
                <DailyQuests questActivitySignal={gs.questActivitySignal} initialQuests={gs.initialQuests} />
              </div>

              {/* Last 8 geocoins — 4×2 */}
              {history.filter(h => !h.skipped).length > 0 && (
                <div style={{ animation: 'fadeUp .4s .2s ease-out both' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: theme.textMuted, marginBottom: 4 }}>{t('last_cards')}</div>
                  <div style={{ background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px' }}>
                  <div style={isWide
                    ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }
                    : { display: 'flex', justifyContent: 'space-between' }}>
                    {history.filter(h => !h.skipped).slice(0, 8).map((h, i) => {
                      const { c1, c2 } = cardCC(h.card?.rarity || 'commun');
                      return (
                        <div key={i} title={h.card?.name} onClick={() => { if (!h.card) return; setSelectedCard(gs.cardPool.find(c => c.id === h.card.id) || h.card); setSelectedCardIsShiny(h.isShiny || false); setSelectedCardFromHistory(true); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', flexShrink: 0, maxWidth: isWide ? undefined : 44 }}>
                          <div style={{ position: 'relative', width: isWide ? '100%' : 44, height: isWide ? undefined : 44, aspectRatio: '1', transition: 'transform .15s', zIndex: 1 }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.zIndex = 10; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1; }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', border: `2px solid ${c1}`, background: theme.bgSurface, boxSizing: 'border-box', boxShadow: h.card?.rarity === 'légendaire' ? `0 0 10px ${c1}99` : 'none' }}>
                              {h.card ? ((h.card.thumbnail || h.card.image_url_thumb || h.card.image || h.card.image_url)
                                ? <ThumbImage src={h.card.thumbnail || h.card.image_url_thumb || h.card.image || h.card.image_url} alt={h.card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{h.card.name[0]}</div>
                              ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 12 }}>?</div>}
                            </div>
                            {h.isShiny && <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 10, lineHeight: 1, animation: 'shinySparkle 2s ease-in-out infinite', filter: 'drop-shadow(0 0 3px gold)', zIndex: 5 }}>✨</div>}
                          </div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: h.won ? '#3fb950' : theme.textSecondary, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.won ? '✓' : h.winner}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* ── RIGHT PANEL : collection / market / forge / top ── */}
          {(isWide || !auth.profile || activeTab !== 'home') && (
            <main style={{ flex: 1, padding: isWide ? '14px 20px' : '12px 14px', minWidth: 0 }}>

              {/* New geocoin available — above type filter */}
              {auth.profile && !activeQuiz && auth.profile?.status !== 'banni' && activeTab !== 'tresors' && (
                <div data-tour="countdown" style={{ marginBottom: 14 }}>
                  <CountdownWidget secondsLeft={countdown} cycleTime={gs.limits?.quizInterval ?? QUIZ_INTERVAL} nextCard={nextCard} hasPendingQuiz={!!pendingQuiz && !lostToWinner} lostTo={lostToWinner ?? null} onJoin={handleJoin} isShiny={quizIsShiny} />
                </div>
              )}

              {/* Type filter tabs */}
              {(!auth.profile || activeTab === 'collection') && gs.cardPool.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                  {types.map(tp => {
                    const pool  = tp === 'Tous' ? gs.cardPool.filter(c => c.rarity !== 'achievement' && c.type !== 'Achievement') : gs.cardPool.filter(c => c.type === tp)
                    const total = pool.length
                    // En mode shiny : owned = cartes avec une version shiny
                    const owned = showShiny
                      ? pool.filter(c => (gs.shinyCollection?.[c.id] || 0) > 0).length
                      : pool.filter(c => (gs.collection[c.id] || 0) > 0).length
                    const pct   = total > 0 ? Math.round(owned / total * 100) : 0
                    const full  = owned === total && total > 0
                    const active = filter === tp
                    return (
                      <button key={tp} onClick={() => { setFilter(tp); setCollPage(0); }} style={{ flexShrink: 0, background: active ? '#f9ca24' : theme.bgSurface, border: `1px solid ${active ? '#f9ca24' : theme.border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all .15s', textAlign: 'center', minWidth: 60 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: active ? '#1a2538' : full ? '#3fb950' : theme.textSecondary, whiteSpace: 'nowrap', marginBottom: 2 }}>{tp === 'Tous' ? t('filter_all') : typeLabel(tp, gs.limits.typeTranslations, lang)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#1a253866' : full ? '#3fb950' : theme.textSecondary }}>{owned}/{total}</span>
                          <div style={{ flex: 1, height: 2, borderRadius: 2, background: active ? '#0000001a' : theme.border, overflow: 'hidden', minWidth: 16 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: active ? '#1a2538' : full ? '#3fb950' : 'linear-gradient(90deg,#f9ca24,#e17055)', transition: 'width .6s' }}/>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Collection content (search + grid) */}
              {(!auth.profile || activeTab === 'collection') && (
                <>
                  {/* Search + missing toggle */}
                  {/* Barre de contrôles : search + filtres + tri */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input value={cardSearch} onChange={e => { setCardSearch(e.target.value); setSelectedCard(null); setCollPage(0); }} placeholder={t('collection_search')}
                      style={{ flex: 1, minWidth: 100, background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textPrimary, padding: '7px 11px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none' }}/>

                    {/* ✨ Shiny */}
                    <button onClick={() => { setShowShiny(v => !v); setCollPage(0); setGridAnimKey(k => k+1); }}
                      style={{ flexShrink: 0, background: showShiny ? '#f9ca2422' : theme.bgInput, border: `1px solid ${showShiny ? '#f9ca24' : theme.border}`, color: showShiny ? '#f9ca24' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {t('filter_shiny')}
                    </button>

                    {/* Tri */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setSortMenuOpen(v => !v)}
                        style={{ background: sortBy !== 'rarity' ? '#74b9ff22' : theme.bgInput, border: `1px solid ${sortBy !== 'rarity' ? '#74b9ff' : theme.border}`, color: sortBy !== 'rarity' ? '#74b9ff' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {sortBy === 'rarity' ? t('sort_rarity') : sortBy === 'name-asc' ? t('sort_name_asc') : t('sort_name_desc')} ⌄
                      </button>
                      {sortMenuOpen && (
                        <>
                          <div onClick={() => setSortMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100, background: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: '0 8px 24px #0008', overflow: 'hidden', minWidth: 130 }}>
                            {[['rarity', t('sort_rarity')], ['name-asc', t('sort_name_asc')], ['name-desc', t('sort_name_desc')]].map(([val, lbl]) => (
                              <button key={val} onClick={() => { setSortBy(val); setGridAnimKey(k => k+1); setCollPage(0); setSortMenuOpen(false); }}
                                style={{ display: 'block', width: '100%', background: sortBy === val ? '#f9ca2418' : 'none', border: 'none', borderBottom: `1px solid ${theme.border}`, color: sortBy === val ? theme.gold : theme.textPrimary, padding: '9px 14px', fontFamily: "'Nunito',sans-serif", fontWeight: sortBy === val ? 900 : 600, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                                {sortBy === val ? '✓ ' : ''}{lbl}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Manquants */}
                    <button onClick={() => { setShowMissing(v => !v); setCollPage(0); }}
                      style={{ flexShrink: 0, background: showMissing ? '#6c5ce7' : theme.bgInput, border: `1px solid ${showMissing ? '#6c5ce7' : theme.border}`, color: showMissing ? '#fff' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {showMissing ? t('filter_owned') : t('filter_missing')}
                    </button>
                  </div>

                  {/* Card grid */}
                  {displayCards.length === 0 ? (
                    gs.loadingData ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', gap: 10 }}>
                        {[0, 0.18, 0.36].map(d => (
                          <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: theme.gold, animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: theme.textSecondary, padding: '60px 0', fontSize: 14 }}>
                        {t('no_cards')}
                      </div>
                    )
                  ) : (() => {
                    const totalPages = Math.ceil(displayCards.length / COLL_PAGE_SIZE)
                    const page = Math.min(collPage, totalPages - 1)
                    const slice = displayCards.slice(page * COLL_PAGE_SIZE, (page + 1) * COLL_PAGE_SIZE)
                    return (
                      <>
                        <div key={gridAnimKey} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: 14, marginBottom: 16 }}>
                          {slice.map(({ card, count, cnt, missing, isShiny }, idx) => {
                            const c = count || cnt || 0;
                            const anim = gridAnimKey > 0
                              ? `cardSort .4s ${Math.min(idx * 0.03, 0.5)}s cubic-bezier(.34,1.56,.64,1) both`
                              : 'slideIn .35s ease both'
                            return (
                              <div key={`${card.id}${isShiny ? '_shiny' : ''}`} style={{ animation: anim }} {...(idx === 0 ? { 'data-tour': 'collection' } : {})}>
                                <Card card={card} count={missing ? 0 : c} dimmed={missing} isShiny={!!isShiny} onClick={missing ? undefined : () => { setSelectedCard(card); setSelectedCardIsShiny(!!isShiny); setSelectedCardFromHistory(false); }} />
                              </div>
                            );
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 }}>
                            <button onClick={() => setCollPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: page===0?theme.bgInput:theme.bgElevated, border: `1px solid ${theme.border}`, color: page===0?theme.textMuted:theme.textPrimary, width: 32, height: 32, borderRadius: 8, cursor: page===0?'default':'pointer', fontWeight: 900, fontSize: 15 }}>‹</button>
                            <span style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 700 }}>{page+1} / {totalPages}</span>
                            <span style={{ fontSize: 11, color: theme.textMuted }}>({displayCards.length})</span>
                            <button onClick={() => setCollPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1} style={{ background: page===totalPages-1?theme.bgInput:theme.bgElevated, border: `1px solid ${theme.border}`, color: page===totalPages-1?theme.textMuted:theme.textPrimary, width: 32, height: 32, borderRadius: 8, cursor: page===totalPages-1?'default':'pointer', fontWeight: 900, fontSize: 15 }}>›</button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}

              {/* Market inline */}
              {auth.profile && activeTab === 'market' && (
                <MarketModal inline loading={gs.loadingData}
                  myCollection={gs.collection} market={gs.market} gold={gs.gold} cardPool={gs.cardPool}
                  myListings={gs.myListings} transactions={gs.transactions}
                  onClose={() => setActiveTab('collection')}
                  onBuy={handleBuy} onListCard={handleListCard} onCancelListing={handleCancelListing} onCancelAllListings={handleCancelAllListings}
                  initialTab={marketTab} initialSellCard={marketTab === 'vendre' ? marketSellCard : null}
                  ranks={gs.limits.playerRanks}
                  marketSalesOpen={gs.limits.marketSalesOpen !== false}
                  listingFee={gs.limits.marketListingFee ?? 4}
                  saleTax={gs.limits.marketSaleTax ?? 0.12}
                  myPseudo={auth.profile?.pseudo}
                  unreadSales={gs.unreadSales}
                  onClearUnreadSales={() => gs.setUnreadSales(0)}
                  onClearNewTransactions={gs.clearNewTransactions}
                />
              )}

              {/* Forge inline */}
              {auth.profile && activeTab === 'forge' && (gs.cardPool.some(c => c.forgeable) || gs.limits.shinyForgeOpen !== false) && (
                <ForgeModal inline loading={gs.loadingData}
                  cardPool={gs.cardPool}
                  collection={gs.collection}
                  shinyCollection={gs.shinyCollection || {}}
                  forgePoints={gs.forgePoints}
                  shinyForgeCostByRarity={gs.limits.shinyForgeCostByRarity ?? {}}
                  onClose={() => setActiveTab('collection')}
                  onForged={(data) => {
                    if (data?.forge_points_remaining !== undefined) {
                      gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
                    }
                    if (data?.card) {
                      gs.setCollection(prev => ({ ...prev, [data.card.id]: (prev[data.card.id] || 0) + 1 }))
                    }
                    if (data?.shiny_card_id) {
                      gs.setShinyCollection(prev => ({ ...prev, [data.shiny_card_id]: (prev[data.shiny_card_id] || 0) + 1 }))
                    }
                  }}
                />
              )}

              {/* Trésors */}
              {auth.profile && activeTab === 'tresors' && (
                <TresorPage
                  dailyOffer={dailyOffer}
                  onClaim={handleClaimDaily}
                  onReveal={(cards, gold, paymentLabel) => { setRevealCards(cards); setRevealGold(gold || 0); setRevealPayment(paymentLabel || ''); setShowShop(true) }}
                  cardPool={gs.cardPool}
                  shopPacksConfig={gs.limits?.shopPacks || {}}
                  shopTestMode={!!gs.limits?.shopTestMode}
                  isAdmin={auth.profile?.role === 'admin'}
                  packsLoading={gs.loadingData}
                />
              )}

              {/* Leaderboard inline */}
              {auth.profile && activeTab === 'top' && (
                <LeaderboardModal inline
                  myCollection={gs.collection} myShinyCollection={gs.shinyCollection}
                  myPseudo={auth.profile?.pseudo} myId={auth.profile?.id}
                  myScore={userScore} myGold={gs.gold} myForgePoints={gs.forgePoints}
                  cardPool={gs.cardPool} ranks={gs.limits.playerRanks}
                  onClose={() => setActiveTab('collection')}
                />
              )}
            </main>
          )}
        </div>
      )}

      {/* ── BOTTOM NAV (mobile) ── */}
      {auth.profile && isMobile && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: theme.navBg, backdropFilter: 'blur(20px)', borderTop: `1px solid ${theme.border}`, display: 'flex' }}>
          {[
            { id: 'home',        icon: '🏠', label: t('nav_home') },
            { id: 'tresors',     icon: '💎', label: t('nav_tresors'), badge: dailyOffer && !dailyOffer.claimed ? 1 : 0 },
            { id: 'collection',  icon: '🃏', label: t('nav_collection'), tour: 'nav-collection' },
            { id: 'market',      icon: '🏪', label: t('nav_market'), badge: gs.unreadSales, tour: 'nav-market' },
            ...(gs.cardPool.some(c => c.forgeable) || gs.limits.shinyForgeOpen !== false ? [{ id: 'forge', icon: '🔨', label: t('nav_forge'), tour: 'nav-forge' }] : []),
            { id: 'top',         icon: '🏆', label: t('nav_top'), tour: 'nav-top' },
          ].map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                data-tour={item.tour}
                style={{ flex: 1, background: 'none', border: 'none', color: active ? '#f9ca24' : theme.textSecondary, padding: '9px 4px 11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative', fontFamily: "'Nunito',sans-serif", transition: 'color .15s' }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .3 }}>{item.label}</span>
                {item.badge > 0 && <span style={{ position: 'absolute', top: 7, left: '55%', background: '#e74c3c', color: '#fff', width: 15, height: 15, borderRadius: '50%', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.badgeBorder}` }}>{item.badge > 9 ? '9+' : item.badge}</span>}
                {active && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#f9ca24', borderRadius: '0 0 3px 3px' }} />}
              </button>
            )
          })}
        </nav>
      )}

      {/* ── Gold flash ── */}
      {goldFlash && (
        <div style={{ position: 'fixed',top: '50%',left: '50%',zIndex: 4000,pointerEvents: 'none',animation: 'goldPop 1.8s ease-out forwards',fontFamily: "'Fredoka One',sans-serif",fontSize: 52,color: theme.gold,textShadow: '0 4px 24px #f9ca2488',whiteSpace: 'nowrap' }}>
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
      {/* QuizNotif popup disabled */}
      {activeQuiz  && <QuizModal quiz={activeQuiz} isShiny={quizIsShiny} onAnswer={wrappedHandleQuizAnswer} onExpire={handleQuizExpire} onClose={handleCloseActiveQuiz} />}

      {showDocs && <DocsLayout initialPage={docsPage} isAdmin={auth.profile?.role === 'admin'} onClose={() => { window.location.replace('/') }} />}

      {seasonPopup && (
        <SeasonPopup
          season={seasonPopup.season}
          cards={seasonPopup.cards}
          onClose={() => {
            setSeasonPopup(null)
            apiMarkSeasonSeen().catch(() => {})
          }}
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
            if (next.length === 0 && onboardingStep === 'card') {
              setOnboardingStep('tour')
            }
          }}
        />
      )}
      {(showTour || onboardingStep === 'tour') && auth.profile && (
        <OnboardingTour setActiveTab={setActiveTab} isMobile={isMobile} onDone={async () => {
          setShowTour(false)
          setOnboardingStep(null)
          const { apiOnboardingDone, apiGetCollection } = await import('./services/api.js')
          await apiOnboardingDone()
          auth.setProfile(p => p ? { ...p, welcome_given: true } : p)
          apiGetCollection().then(({ data }) => {
            if (data?.collection) {
              gs.setCollection(data.collection)
              if (data.shiny_collection) gs.setShinyCollection(data.shiny_collection)
            }
          })
          setActiveTab('collection')
        }} />
      )}

      {/* ── Prompt inscription — bloque la réponse au quiz pour les invités ── */}
      {showRegisterPrompt && !auth.profile && (
        <div style={{ position: 'fixed', inset: 0, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, backdropFilter: 'blur(10px)', padding: 20 }}>
          <div style={{ background: `linear-gradient(145deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 24, padding: '32px 28px', width: 'min(94vw,400px)', border: '1.5px solid #6c5ce744', boxShadow: '0 32px 80px #000b', fontFamily: "'Nunito',sans-serif", textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: theme.gold, marginBottom: 8 }}>
              {t('register_prompt_title')}
            </div>
            <div style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
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
              <button onClick={() => { setMarketUnlockBanner(false); setActiveTab('market'); }}
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
          count={selectedCardFromHistory ? 0 : selectedCardIsShiny ? (gs.shinyCollection?.[selectedCard.id] || 0) : (gs.collection[selectedCard.id] || 0)}
          isShiny={selectedCardIsShiny}
          onClose={() => { setSelectedCard(null); setSelectedCardIsShiny(false); setSelectedCardFromHistory(false); }}
          onSell={() => { setMarketSellCard(selectedCard); setSelectedCard(null); setSelectedCardIsShiny(false); setSelectedCardFromHistory(false); setMarketTab('vendre'); setActiveTab('market'); }}
        />
      )}
      {showAuth        && <AuthModal auth={auth} onClose={() => setShowAuth(false)} onSuccess={handleLoginSuccess} />}
      {showChoosePseudo && <AuthModal auth={auth} initialMode="choose_pseudo" onClose={() => setShowChoosePseudo(false)} onSuccess={() => setShowChoosePseudo(false)} />}
      {showScoreDetail && (() => {
        const W = gs.limits.scoreRules || { commun: 1, rare: 3, épique: 7, légendaire: 20 }
        const rarities = ['légendaire', 'épique', 'rare', 'commun']
        const rows = rarities.map(r => {
          const normal = Object.entries(gs.collection).filter(([id, n]) => n > 0 && gs.cardPool.find(c => c.id === +id)?.rarity === r).length
          const shiny  = Object.entries(gs.shinyCollection || {}).filter(([id, n]) => n > 0 && gs.cardPool.find(c => c.id === +id)?.rarity === r).length
          return { r, normal, shiny, pts: W[r] }
        }).filter(row => row.normal > 0 || row.shiny > 0)
        const labels = { commun: t('rarity_commun'), rare: t('rarity_rare'), épique: t('rarity_epique'), légendaire: t('rarity_legendaire') }
        const { c1 } = rankCC(getRank(userScore, gs.limits.playerRanks))
        return (
          <div onClick={() => setShowScoreDetail(false)} style={{ position:'fixed', inset:0, background:'#000c', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3500, backdropFilter:'blur(8px)', padding:16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: theme.bgSurface, border:`1px solid ${theme.border}`, borderRadius:16, padding:'20px 24px', width:'min(94vw,360px)', fontFamily:"'Nunito',sans-serif", boxShadow:'0 24px 60px #0008' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:18, color:theme.textPrimary }}>{t('score_detail_title')}</div>
                <button onClick={() => setShowScoreDetail(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:theme.textMuted }}>✕</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {rows.map(({ r, normal, shiny, pts }) => (
                  <div key={r}>
                    {normal > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:theme.overlay, borderRadius:8 }}>
                        <span style={{ fontSize:13, color:theme.textPrimary, fontWeight:700 }}>{normal} × {labels[r]}</span>
                        <span style={{ fontSize:13, color:theme.gold, fontWeight:900 }}>+{normal * pts} pts</span>
                      </div>
                    )}
                    {shiny > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:theme.overlay, borderRadius:8, marginTop: normal > 0 ? 4 : 0 }}>
                        <span style={{ fontSize:13, color:theme.textPrimary, fontWeight:700 }}>{shiny} × {labels[r]} ✨</span>
                        <span style={{ fontSize:13, color:theme.gold, fontWeight:900 }}>+{shiny * pts * (gs.limits.shinyMultiplier ?? 2)} pts</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${theme.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:14, fontWeight:800, color:theme.textPrimary }}>{t('score_detail_total')}</span>
                <span style={{ fontSize:18, fontWeight:900, color:c1 }}>{userScore} pts</span>
              </div>

              {/* Paliers de rang */}
              {(() => {
                const ranks = [...(gs.limits.playerRanks || DEFAULT_RANKS)].sort((a,b) => a.min - b.min)
                const currentRank = getRank(userScore, gs.limits.playerRanks)
                return (
                  <div>
                    <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:theme.textMuted, marginBottom:8 }}>{t('score_detail_tiers')}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {ranks.map(rank => {
                        const isCurrent = rank.label === currentRank?.label
                        const reached = userScore >= rank.min
                        return (
                          <div key={rank.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:8, background: isCurrent ? `${rank.color}22` : theme.overlay, border: isCurrent ? `1px solid ${rank.color}66` : `1px solid ${theme.border}`, opacity: reached ? 1 : 0.5 }}>
                            <span style={{ fontSize:14 }}>{rank.icon}</span>
                            <span style={{ flex:1, fontSize:12, fontWeight: isCurrent ? 900 : 700, color: isCurrent ? rank.color : theme.textPrimary }}>{rank.label}</span>
                            <span style={{ fontSize:11, fontWeight:700, color: reached ? rank.color : theme.textMuted }}>{rank.min} pts</span>
                            {isCurrent && <span style={{ fontSize:9, fontWeight:900, color:rank.color, background:`${rank.color}22`, padding:'1px 6px', borderRadius:50 }}>{t('score_detail_current')}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

      {showSettings && auth.profile && <SettingsModal auth={auth} collection={gs.collection} cardPool={gs.cardPool} unlockedAch={gs.unlockedAch} ranks={gs.limits.playerRanks} score={userScore} onStartTour={() => { setShowSettings(false); setShowTour(true) }} onClose={() => setShowSettings(false)} />}
      {showShop && <ShopModal onClose={() => { setShowShop(false); setShopPackId(null); setRevealCards(null); setRevealGold(0); setRevealPayment('') }} cardPool={gs.cardPool} onPurchase={handlePurchase} shopPacksConfig={gs.limits?.shopPacks || {}} initialPackId={shopPackId} initialCards={revealCards} initialGold={revealGold} initialPaymentLabel={revealPayment} />}
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
                apiSetConfig('quiz_interval',    limEdit.quizInterval  ?? 60),
                apiSetConfig('quiz_join_gold',   limEdit.quizJoinGold  ?? 1),
                apiSetConfig('quiz_win_gold',    limEdit.quizWinGold   ?? 5),
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
                apiSetConfig('shiny_rate',        limEdit.shinyRate        ?? 0.1),
                apiSetConfig('shiny_forge_open',  limEdit.shinyForgeOpen   ?? true),
                apiSetConfig('score_rules',       limEdit.scoreRules       ?? { commun:1, rare:3, épique:7, légendaire:20 }),
                apiSetConfig('shiny_multiplier',          limEdit.shinyMultiplier        ?? 2),
                ...(limEdit.shinyForgeCostByRarity != null ? [apiSetConfig('shiny_forge_cost_by_rarity', limEdit.shinyForgeCostByRarity)] : []),
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
          onShopPacksSaved={packs => gs.setLimits(prev => ({ ...prev, shopPacks: packs }))}
          onShopTestModeChange={val => gs.setLimits(prev => ({ ...prev, shopTestMode: val }))}
        />
      )}

    </div>
  );
}
