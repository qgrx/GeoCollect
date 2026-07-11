import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext.jsx';
import { THEMES } from './theme.js';

// ─── i18n ─────────────────────────────────────────────────────────────────────
import { useT, setLang, LANGS, getLang } from './i18n/translations.js'
import LangSelector from './i18n/LangSelector.jsx';
import Logo from './components/Logo.jsx';

// ─── Data & utils ─────────────────────────────────────────────────────────────
import { RC, cardCC, RARITY_CONFIG, rarityLabel, cardName, typeLabel } from './data/cards.js';
import { QUIZ_INTERVAL, PSEUDO_NOTIF_DAYS, DEFAULT_RANKS, DEFAULT_RARITY_RATES } from './data/constants.js';
import { collScore, computeCardLimitStatus, countOwnedUnique, computeStreakHandicap, isHandicapExemptCard } from './utils/gameUtils.js';
import { isCorrectAnswer } from './utils/answer.js';

// ─── State hooks ──────────────────────────────────────────────────────────────
import { useGameState } from './hooks/useGameState.js'
import { useQuiz } from './hooks/useQuiz.js'
import { useBeginnerQuiz } from './hooks/useBeginnerQuiz.js'
import { apiSetConfig, apiGetCurrentQuiz, apiAdminToggleQuestion, apiGetQuizHistory, apiAdminGetQuestions, apiAdminAddQuestion, apiReleaseHiddenQuestions, apiGetDailyTreasure, apiClaimDailyTreasure, apiGetCurrentSeason, apiMarkSeasonSeen, apiGetHold, apiClaimHold, apiBuyHoldSlot, apiRentHoldSlot, apiTakeForgeInsteadOfHold, apiBuyPocketBoost, apiBuyBagSlot, apiPingProfile, apiGetDemo, apiDemoClaim, apiBuyOffseasonCard } from './services/api.js'
import { soundQuizNew, soundMarketSale, useVolume } from './utils/sounds.js'
import { getSocket, disconnectSocket } from './services/socket.js'
import { useAuth } from './hooks/useAuth.js';

// ─── Components ───────────────────────────────────────────────────────────────
import Card from './components/Card.jsx';
import CollectionScroll from './components/CollectionScroll.jsx';
import CollectionOverview from './components/CollectionOverview.jsx';
import CardDetailModal from './components/CardDetailModal.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import PseudoDisplay from './components/PseudoDisplay.jsx';
import { getRank, isTopRank, rankCC, getRankLabel } from './utils/rankUtils.js';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';
import VolumeControl from './components/VolumeControl.jsx';

// ─── Features ────────────────────────────────────────────────────────────────
import AuthModal from './features/auth/AuthModal.jsx';
import SettingsModal from './features/auth/SettingsModal.jsx';
import ReferralModal from './features/referral/ReferralModal.jsx';
import LandingSection from './features/landing/LandingSection.jsx';
import { DemoComplete } from './features/demo/DemoGame.jsx';
import { QuizNotif, QuizModal, CountdownWidget, ThumbImage, HoldModal, ModeToggle, BeginnerCountdownWidget, BeginnerRecap, BeginnerWinnersModal, GameRulesModal, GloryInfoModalHost, LimitInfoModalHost } from './features/quiz/QuizComponents.jsx';
import MarketModal from './features/market/MarketModal.jsx';
import LeaderboardModal from './features/leaderboard/LeaderboardModal.jsx';
import AdminPanel from './features/admin/AdminPanel.jsx';
import CgvPage from './features/cgv/CgvPage.jsx';
import ShopModal from './features/shop/ShopModal.jsx';
import { AchievementToast, AchievementUpgradePopup, SaleNotif, TxHistoryModal } from './features/achievements/NotifComponents.jsx';
import DailyQuests from './features/quests/DailyQuests.jsx';
import ForgeModal  from './features/forge/ForgeModal.jsx'
import TresorPage  from './features/treasures/TresorPage.jsx';
import SeasonPopup  from './components/SeasonPopup.jsx';
import DocsLayout   from './features/docs/DocsLayout.jsx';

// Lien d'invitation Discord (menu avatar)
const DISCORD_URL = 'https://discord.gg/QE5fM6H6n';

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

// ── Mode démo (invité) : données statiques réutilisant les vrais composants ──
// 3 quêtes du jour factices (non incrémentables) + générateur de faux « derniers
// geocoins disputés » (pseudos du top × geocoins hommage), pour un accueil crédible.
const DEMO_QUESTS = [
  { id: 'demo-q1', name: 'Connecte-toi aujourd’hui', progress: 0, threshold: 1, type: 'daily_connection', forge_points: 0, gold_reward: 20, completed_at: null,
    translations: { fr: { name: 'Connecte-toi aujourd’hui' }, en: { name: 'Log in today' }, de: { name: 'Melde dich heute an' }, es: { name: 'Conéctate hoy' } } },
  { id: 'demo-q2', name: 'Atteins 6 geocoins uniques', progress: 0, threshold: 6, type: 'collection_size', forge_points: 2, gold_reward: 0, completed_at: null,
    translations: { fr: { name: 'Atteins 6 geocoins uniques' }, en: { name: 'Reach 6 unique geocoins' }, de: { name: 'Erreiche 6 einzigartige Geocoins' }, es: { name: 'Alcanza 6 geocoins únicos' } } },
  { id: 'demo-q3', name: 'Réclame ton trésor du jour', progress: 0, threshold: 1, type: 'daily_treasure', forge_points: 0, gold_reward: 50, completed_at: null,
    translations: { fr: { name: 'Réclame ton trésor du jour' }, en: { name: 'Claim your daily treasure' }, de: { name: 'Hol dir deinen Tagesschatz' }, es: { name: 'Reclama tu tesoro del día' } } },
]
// Geocoins démo gagnés, mémorisés dans le navigateur (pas de compte). Crédités au
// vrai inventaire à la création du compte (POST /api/demo/claim), puis effacés.
const DEMO_EARNED_KEY = 'geocoins_demo_earned'
const readDemoEarned  = () => { try { return JSON.parse(localStorage.getItem(DEMO_EARNED_KEY) || '[]') } catch { return [] } }
const writeDemoEarned = (ids) => { try { localStorage.setItem(DEMO_EARNED_KEY, JSON.stringify([...new Set(ids)])) } catch { /* quota/private */ } }
const clearDemoEarned = () => { try { localStorage.removeItem(DEMO_EARNED_KEY) } catch { /* ignore */ } }

const buildDemoHistory = (pseudos, tribute, n = 8) => {
  if (!tribute?.length) return []
  return Array.from({ length: n }, () => ({
    card:   tribute[Math.floor(Math.random() * tribute.length)],
    winner: pseudos?.length ? pseudos[Math.floor(Math.random() * pseudos.length)] : '—',
    won: false, isShiny: false,
  }))
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

  const [pendingCheckout, setPendingCheckout] = useState(
    () => new URLSearchParams(window.location.search).get('checkout_id') || null
  )

  // ── Confirmation email uniquement — le SDK Supabase nettoie lui-même l'URL OAuth ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')
    if (type === 'signup') {
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => showToast('✅ Email confirmé ! Bienvenue 🎉'), 500)
    }
  }, [])

  // ── Retour de paiement SumUp (?checkout_id=...) ──────────────────────────────
  useEffect(() => {
    if (!pendingCheckout || !auth.profile || !gs.cardPool.length) return
    const cid = pendingCheckout
    setPendingCheckout(null)
    window.history.replaceState({}, '', window.location.pathname)
    import('./services/api.js').then(({ apiGetPurchase }) => {
      apiGetPurchase(cid).then(({ data }) => {
        if (data?.status !== 'paid') return
        const cards = (data.card_ids || []).map(id => gs.cardPool.find(c => c.id === id)).filter(Boolean)
        setRevealCards(cards)
        setRevealGold(data.gold || 0)
        setRevealPayment('')
        setShowShop(true)
        // Rafraîchir collection et profil crédités côté serveur
        import('./services/api.js').then(({ apiGetCollection, apiGetProfile }) => {
          apiGetCollection?.().then(({ data: d }) => {
            if (d?.collection) gs.setCollection(d.collection)
            if (d?.shiny_collection) gs.setShinyCollection(d.shiny_collection)
          })
          apiGetProfile?.().then(({ data: d }) => { if (d?.profile) auth.setProfile(d.profile) })
        })
      })
    })
  }, [pendingCheckout, auth.profile?.id, gs.cardPool.length])

  // ── Charger l'historique des quiz depuis la DB ────────────────────────────────
  // Aussi rappelé à chaque reconnexion socket et au retour d'onglet : les
  // quiz:solved / quiz:expired émis pendant une coupure (veille mobile, onglet
  // gelé) sont perdus → sans re-fetch, le strip « derniers geocoins disputés »
  // restait figé jusqu'à un rechargement manuel de la page.
  const refreshQuizHistory = () => {
    if (!auth.profile || !import.meta.env.VITE_API_URL) return
    if (auth.isDemo) return  // démo : faux feed local, pas d'appel API
    apiGetQuizHistory(10).then(({ data }) => {
      if (data?.history?.length) {
        // Sécurité : filtrer d'éventuelles ventes qui se seraient glissées depuis l'API
        setHistory(data.history.filter(h => h.price === undefined && h.type !== 'vente' && h.type !== 'achat' && h.buyer === undefined))
      }
    }).catch(() => {})
  }
  const refreshQuizHistoryRef = useRef(refreshQuizHistory)
  useEffect(() => { refreshQuizHistoryRef.current = refreshQuizHistory })
  useEffect(() => { refreshQuizHistoryRef.current() }, [auth.profile?.id])

  // Retour d'onglet après une longue absence : re-fetch immédiat, sans attendre
  // que socket.io détecte une connexion morte (jusqu'à ~45 s de ping timeout
  // pendant lesquelles le socket paraît connecté et le strip resterait figé).
  useEffect(() => {
    let hiddenAt = null
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt > 60_000) refreshQuizHistoryRef.current()
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // ── Notifications navigateur ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [auth.profile?.id])

  // ── Erreur OAuth (retour de redirection Supabase, ex. conversion Google échouée) ──
  // Ex. identity_already_exists : le compte Google est déjà lié à un autre compte.
  // On affiche un message clair et on nettoie l'URL (sinon état confus persistant).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (!q.get('error') && !h.get('error')) return
    const desc = q.get('error_description') || h.get('error_description') || ''
    window.history.replaceState({}, '', window.location.pathname)
    showToast(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : t('oauth_error'), 'error')
  }, [])

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
    if (auth.isDemo) return    // démo : pas de quiz global (parcours solo injecté)

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
        if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)
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
          server_time: data.server_time,   // ancrage horloge pour le décompte handicap (skew device)
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
        setLostToGlory(false)
        setStreakLeader(data.streak_leader || null)
        // Un quiz devient joignable → couper l'annonce « en feu » pour ne pas masquer « Participer »
        if (streakHypeTimerRef.current) clearTimeout(streakHypeTimerRef.current)
        setStreakHype(null)

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
          // Mode Entraînement actif → pas de son du quiz PvP (la barre PvP est déjà masquée).
          if (!beginnerActiveRef.current) soundQuizNew()
        } else {
          // Snoozé : on n'affiche pas le nouveau quiz, mais on RETIRE l'ancien pending
          // (il appartient au tour précédent → sinon « Participer » sur un quiz périmé).
          setPendingQuiz(null)
        }
        if (!beginnerActiveRef.current) sendPushNotif(card)
      })

      // Quiz — résolu par quelqu'un
      s.on('quiz:solved', (data) => {
        // Sécurité : ignorer si l'événement WebSocket contient des attributs de transaction (bug backend)
        if (data.price !== undefined || data.buyer !== undefined || data.type === 'vente' || data.type === 'achat') return

        setQuizSessionActive(false)

        // Si le quiz résolu est celui actuellement EN ATTENTE (non rejoint), le marquer
        // « gagné » tout de suite : handleJoin refuse alors de le rejoindre et la barre
        // ne propose plus « Participer » sur un quiz déjà gagné (robuste aux courses
        // avec quiz:new / au snooze).
        if (data.quiz_id) setPendingQuiz(p => (p && p.id === data.quiz_id) ? { ...p, winner: data.winner || '?' } : p)

        // Mettre à jour le prochain quiz dès quiz:solved (sans attendre quiz:new).
        // applyServerSchedule fait primer l'horaire dynamique serveur sur le calcul local.
        if (data.next_quiz_at && data.server_time) {
          const nextAt    = new Date(data.next_quiz_at).getTime()
          const serverNow = new Date(data.server_time).getTime()
          const msLeft    = Math.max(0, nextAt - serverNow)
          applyServerSchedule(Date.now() + msLeft, Math.round(msLeft / 1000))
        }
        setQuizIsShiny(data.next_is_shiny || false)
        if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)

        // Série de victoires → annonce « en feu » en grand pendant 10 s (handicap bienveillant).
        // En round multi-prix, l'animation a déjà été déclenchée au quiz:prize_won (1er gagnant)
        // → on ne la rejoue pas et on ne réinitialise pas le leader ici.
        const hCfg = gs.limits?.quizStreakHandicap
        const threshold = Math.max(1, Number(hCfg?.threshold) || 3)
        if (data.multi) {
          // « en feu » géré au prize_won — ne rien faire
        } else if (data.winner_streak >= threshold && hCfg?.enabled !== false) {
          // Délai fourni par le serveur (config fraîche) ; repli sur calcul client si absent
          const handicap = data.winner_handicap != null ? data.winner_handicap : computeStreakHandicap(data.winner_streak, hCfg)
          // Prochaine carte exemptée (légendaire / épique brillante) → pas de « cadeau » annoncé
          const nextExempt = isHandicapExemptCard(data.next_card_rarity, data.next_is_shiny)
          setStreakHype({ pseudo: data.winner, streak: data.winner_streak, handicap, exempt: nextExempt })
          // MAJ immédiate du leader (évite le décalage de 1 victoire pendant le teaser)
          setStreakLeader({ id: data.winner_id || null, pseudo: data.winner, streak: data.winner_streak, handicap_seconds: handicap })
          if (streakHypeTimerRef.current) clearTimeout(streakHypeTimerRef.current)
          // 10 s d'affichage, puis fondu sortant (~400 ms) avant démontage
          streakHypeTimerRef.current = setTimeout(() => {
            setStreakHype(h => h ? { ...h, fading: true } : h)
            streakHypeTimerRef.current = setTimeout(() => setStreakHype(null), 420)
          }, 10000)
        } else {
          setStreakLeader(null) // série cassée (gagnant sous le seuil)
        }

        // winner_id (id exact) prioritaire ; repli pseudo. En multi-prix, je suis « gagnant »
        // si je figure dans prize_winners (je peux avoir pris le 2e prix). Via refs → jamais périmé.
        const winnersList = Array.isArray(data.prize_winners) ? data.prize_winners : []
        const iSelf = (!!data.winner_id && data.winner_id === myIdRef.current)
          || (!!data.winner && data.winner === myPseudoRef.current)
          || winnersList.some(w => (w.id && w.id === myIdRef.current) || (w.pseudo && w.pseudo === myPseudoRef.current))

        if (!iSelf) {
          handleQuizExpireRef.current(data.winner, data.is_bot)
        } else if (activeQuizRef.current && activeQuizRef.current.id === data.quiz_id) {
          // J'ai gagné ce quiz côté serveur. Si la modale est encore ouverte (réponse
          // HTTP perdue / erreur), la fermer proprement plutôt que de laisser re-répondre.
          setTimeout(() => advanceQuizRef.current?.(Date.now()), 2200)
        }

        // Mettre à jour l'historique. En round MULTI-prix, on bâtit UNE SEULE entrée pour le round
        // (liste de tous les gagnants) au lieu de dupliquer le même geocoin par gagnant : affichage
        // « N🏆 » + popup des gagnants, comme pour la gloire. L'entrée « Moi » transitoire posée par
        // handleQuizAnswer est fusionnée ici (→ ✓ + compteur, sans attendre un rechargement).
        if (data.multi && winnersList.length) {
          const fullCard = cardPoolRef.current?.find(c => c.name === data.card_name)
            || { name: data.card_name, rarity: data.rarity, type: 'Normal', id: 0 }
          const gloryPseudos = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold }))
          const winnerPseudos = winnersList.map(w => w.pseudo)
          const entry = {
            card: fullCard,
            winner: winnerPseudos[0] || null,
            won: iSelf,
            isBot: !!winnersList[0]?.is_bot,
            isShiny: data.is_shiny || false,
            winners: winnerPseudos,          // liste complète des gagnants du round multi-prix
            glory_winners: gloryPseudos,
            quiz_id: data.quiz_id,
          }
          setHistory(h => {
            // Round déjà consolidé (event reçu 2×) → ne rien refaire.
            if (data.quiz_id && h.some(e => Array.isArray(e.winners) && e.quiz_id === data.quiz_id)) return h
            // Retirer les entrées transitoires de CE round : l'entrée « Moi » (handleQuizAnswer)
            // et d'éventuels singletons par gagnant (sans liste `winners`) — puis insérer l'entrée unique.
            const cleaned = h.filter(e => !(!Array.isArray(e.winners) && e.card?.name === data.card_name
                && (e.won || winnerPseudos.includes(e.winner))))
            return [entry, ...cleaned].slice(0, 10)
          })
        } else if (data.winner && !iSelf) {
          const fullCard = cardPoolRef.current?.find(c => c.name === data.card_name)
            || { name: data.card_name, rarity: data.rarity, type: 'Normal', id: 0 }
          const gloryPseudos = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold }))
          setHistory(h => {
            if (data.quiz_id && h.some(e => e.quiz_id === data.quiz_id)) return h
            return [{ card: fullCard, winner: data.winner, won: false, isBot: data.is_bot || false, isShiny: data.is_shiny || false, glory_winners: gloryPseudos, quiz_id: data.quiz_id }, ...h].slice(0, 10)
          })
        } else if (iSelf && (data.glory_winners || []).length > 0) {
          // Le gagnant lui-même : useQuiz ajoute l'entrée → on la patch avec les glory_winners
          const gloryPseudos = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold }))
          setHistory(h => {
            const idx = h.findIndex(e => e.won && (data.quiz_id ? e.quiz_id === data.quiz_id : e.card?.name === data.card_name))
            if (idx < 0) return h
            return [...h.slice(0, idx), { ...h[idx], glory_winners: gloryPseudos }, ...h.slice(idx + 1)]
          })
        }
      })

      // Quiz — un geocoin pris dans un round multi-prix, mais il en RESTE : ouvrir/ré-armer
      // le décompte de grâce chez tous et signaler la prise. NE termine PAS le cycle (le
      // prochain quiz attend la résolution complète, diffusée via quiz:solved).
      s.on('quiz:prize_won', (data) => {
        if (!data.quiz_id) return
        const iSelf = (!!data.winner_id && data.winner_id === myIdRef.current)
          || (!!data.winner && data.winner === myPseudoRef.current)

        // Deadline de grâce locale, corrigée du décalage d'horloge serveur/client.
        let graceDeadline = null
        if (data.grace_until && data.server_time) {
          const msLeft = Math.max(0, new Date(data.grace_until).getTime() - new Date(data.server_time).getTime())
          graceDeadline = Date.now() + msLeft
        }
        const patch = q => (q && q.id === data.quiz_id)
          ? { ...q, graceDeadline, prizes_remaining: data.prizes_remaining }
          : q
        setActiveQuiz(patch)
        if (activeQuizRef.current?.id === data.quiz_id) {
          activeQuizRef.current = { ...activeQuizRef.current, graceDeadline, prizes_remaining: data.prizes_remaining }
        }
        setPendingQuiz(patch)

        if (iSelf) return  // le gagnant a déjà refermé sa modale (handleQuizAnswer, final=false)

        // Toast « X a décroché un geocoin — encore Ns ! » — tu en mode Entraînement (notif PvP).
        if (!beginnerActiveRef.current) {
          const secLeft = graceDeadline ? Math.max(1, Math.ceil((graceDeadline - Date.now()) / 1000)) : (data.prizes_remaining || 1)
          showToast(t('quiz_prize_taken_toast').replace('{pseudo}', data.winner || '?').replace('{n}', secLeft))
        }

        // « En feu » : seul le 1er gagnant (prize_index 0) porte la série → MAJ leader (handicap)
        // + animation. Le quiz:solved multi ne la rejouera pas (guard data.multi).
        const hCfg = gs.limits?.quizStreakHandicap
        const threshold = Math.max(1, Number(hCfg?.threshold) || 3)
        if (data.prize_index === 0 && data.winner_streak != null && data.winner_streak >= threshold && hCfg?.enabled !== false) {
          const handicap = data.winner_handicap != null ? data.winner_handicap : computeStreakHandicap(data.winner_streak, hCfg)
          setStreakLeader({ id: data.winner_id || null, pseudo: data.winner, streak: data.winner_streak, handicap_seconds: handicap })
          setStreakHype({ pseudo: data.winner, streak: data.winner_streak, handicap, exempt: false })
          if (streakHypeTimerRef.current) clearTimeout(streakHypeTimerRef.current)
          streakHypeTimerRef.current = setTimeout(() => {
            setStreakHype(h => h ? { ...h, fading: true } : h)
            streakHypeTimerRef.current = setTimeout(() => setStreakHype(null), 420)
          }, 10000)
        }
      })

      // Quiz — victoire « pour la gloire » (joueur à toutes les limites, quiz reste actif)
      s.on('quiz:glory_win', (data) => {
        const iSelf = (!!data.winner_id && data.winner_id === myIdRef.current)
          || (!!data.winner && data.winner === myPseudoRef.current)
        // Fenêtre de grâce « encore Ns pour répondre » : la poser chez TOUS les joueurs qui ont
        // le quiz ouvert (comme le multi-prix), pour les prévenir qu'il ne reste plus longtemps.
        if (data.grace_until && data.server_time && data.quiz_id) {
          const msLeft = Math.max(0, new Date(data.grace_until).getTime() - new Date(data.server_time).getTime())
          const graceDeadline = Date.now() + msLeft
          const patch = q => (q && q.id === data.quiz_id) ? { ...q, graceDeadline } : q
          setActiveQuiz(patch)
          if (activeQuizRef.current?.id === data.quiz_id) {
            activeQuizRef.current = { ...activeQuizRef.current, graceDeadline }
          }
          setPendingQuiz(patch)
        }
        if (!iSelf && data.winner && !beginnerActiveRef.current) {
          showToast(t('toast_glory_other').replace('{pseudo}', data.winner))
        }
      })

      // Quiz — expiré sans réponse
      s.on('quiz:expired', (data) => {
        setQuizSessionActive(false)
        // Geocoin joué « pour la gloire » mais que personne n'a remporté → l'ajouter au strip
        // des derniers geocoins disputés (winner null, glory_winners renseignés).
        if ((data.glory_winners || []).length > 0 && data.card_name) {
          const fullCard = cardPoolRef.current?.find(c => c.id === data.card_id || c.name === data.card_name)
            || { name: data.card_name, rarity: data.rarity, type: 'Normal', id: data.card_id || 0 }
          const gloryPseudos = (data.glory_winners || []).map(g => ({ pseudo: g.pseudo, hold: !!g.hold }))
          setHistory(h => {
            if (data.quiz_id && h.some(e => e.quiz_id === data.quiz_id)) return h
            return [{ card: fullCard, winner: null, won: false, isBot: false, isShiny: data.is_shiny || false, glory_only: true, glory_winners: gloryPseudos, quiz_id: data.quiz_id }, ...h].slice(0, 10)
          })
        }
        if (data.next_quiz_at && data.server_time) {
          const msLeft = Math.max(0, new Date(data.next_quiz_at).getTime() - new Date(data.server_time).getTime())
          applyServerSchedule(Date.now() + msLeft, Math.round(msLeft / 1000))
        }
        setQuizIsShiny(data.next_is_shiny || false)
        if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)
        // Personne n'a raflé le geocoin ; s'il a été joué pour la gloire, afficher le 1er
        // gagnant-gloire dans la barre (« a joué pour la gloire » + ⓘ), pas « a remporté ».
        handleQuizExpireRef.current((data.glory_winners || [])[0]?.pseudo || null, false, true)
      })

      // Teaser mis à jour sans changement de quiz (ex. admin modifie le Shiny Day) :
      // on rafraîchit uniquement le statut brillant / la rareté du PROCHAIN quiz.
      s.on('quiz:teaser', (data) => {
        setQuizIsShiny(data.next_is_shiny || false)
        if (data.next_card_rarity) setNextQuizRarity(data.next_card_rarity)
      })

      // Mode Débutant — nouvelle manche / fin de manche / quelqu'un a répondu
      s.on('beginner:new',      (data) => beginnerRef.current?.applyBeginnerNew(data))
      s.on('beginner:closed',   (data) => beginnerRef.current?.applyBeginnerClosed(data))
      s.on('beginner:answered', ()     => beginnerRef.current?.refreshHistory())

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

      // Publication groupée de cartes (admin) → recharge le pool en temps réel
      s.on('cards:released', () => {
        gs.reloadCards?.()
        showToast(t('new_cards_released'), 'success')
      })

      // Publication groupée d'achievements (admin) → recharge les achievements
      s.on('achievements:released', () => {
        gs.refreshAchievements?.()
        showToast(t('new_achievements_released'), 'success')
      })

      s.on('connect',    () => {
        setSocketOnline(true)
        // Re-synchroniser après une (re)connexion : les quiz résolus pendant la
        // coupure n'ont jamais été reçus → recharger les derniers geocoins disputés…
        refreshQuizHistoryRef.current()
        // …et réaligner le pending sur l'état serveur pour ne pas laisser
        // « Participer » sur un quiz déjà gagné.
        apiGetCurrentQuiz().then(({ data }) => {
          if (!data) return
          const activeId = data.quiz?.id ?? null
          setPendingQuiz(p => (!p || (activeId && p.id === activeId)) ? p : null)
          if (!data.quiz && data.next_quiz_at && data.server_time) {
            const msLeft = Math.max(0, new Date(data.next_quiz_at).getTime() - new Date(data.server_time).getTime())
            applyServerSchedule(Date.now() + msLeft, Math.round(msLeft / 1000))
          }
        }).catch(() => {})
      })
      s.on('disconnect', () => setSocketOnline(false))
      s.on('connect_error', () => setSocketOnline(false))
    })

    return () => {
      socket?.off('quiz:new')
      socket?.off('quiz:solved')
      socket?.off('quiz:prize_won')
      socket?.off('quiz:glory_win')
      socket?.off('quiz:expired')
      socket?.off('quiz:teaser')
      socket?.off('beginner:new')
      socket?.off('beginner:closed')
      socket?.off('beginner:answered')
      socket?.off('market:sold')
      socket?.off('maintenance')
      socket?.off('announcement')
      socket?.off('cards:released')
      socket?.off('achievements:released')
      socket?.off('connect')
      socket?.off('disconnect')
      socket?.off('connect_error')
    }
  }, [auth.profile?.id])

  // ── Présence : ping périodique (token frais via apiFetch) qui rafraîchit
  // last_seen_at et renvoie le nombre d'utilisateurs en ligne ─────────────────
  useEffect(() => {
    if (!auth.profile?.id || !import.meta.env.VITE_API_URL) return
    if (auth.isDemo) return  // démo : pas de présence (compteur en ligne masqué)
    let active = true
    const ping = async () => {
      const { data } = await apiPingProfile().catch(() => ({ data: null }))
      if (active && data && typeof data.online === 'number') setOnlineCount(data.online)
    }
    ping()
    const iv = setInterval(ping, 60_000)
    return () => { active = false; clearInterval(iv) }
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
  const [showAdmin,       setShowAdmin]       = useState(() => window.location.pathname === '/admin');
  const [showCgv,         setShowCgv]         = useState(false);
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
  const [showReferral,    setShowReferral]    = useState(false);
  const [showShop,        setShowShop]        = useState(false);
  const [shopPackId,      setShopPackId]       = useState(null);
  const [revealCards,     setRevealCards]      = useState(null);
  const [revealGold,      setRevealGold]       = useState(0);
  const [revealPayment,   setRevealPayment]    = useState('');
  const [showTxHistory,   setShowTxHistory]   = useState(false);
  const [filter,          setFilter]          = useState('Tous');
  const [showMissing,     setShowMissing]     = useState(false);
  const [showShiny,       setShowShiny]       = useState(false);
  const [demoInfo,        setDemoInfo]        = useState(null);  // 'shiny' | 'rarity' : présentation feature en démo
  const [sortBy,          setSortBy]          = useState('rarity'); // 'rarity'|'name-asc'|'name-desc'
  const [sortMenuOpen,    setSortMenuOpen]    = useState(false);
  const [gridAnimKey,     setGridAnimKey]     = useState(0);
  const [cardSearch,      setCardSearch]      = useState('');
  const [collViewAll,     setCollViewAll]     = useState(false);  // vue d'ensemble « tout en un » (manquants inclus, sans pagination)
  const [quizSessionActive, setQuizSessionActive] = useState(false);
  const [dailyOffer, setDailyOffer] = useState(null);
  const [holds,      setHolds]      = useState([]);          // geocoins en attente (multi-emplacements)
  const [holdSlots,  setHoldSlots]  = useState(0);           // emplacements permanents achetés (0→2)
  const [holdRentActive, setHoldRentActive] = useState(false); // emplacement 4 loué actif
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
  const [onlineCount,     setOnlineCount]     = useState(0);
  const [streakLeader,    setStreakLeader]    = useState(null);   // { id, pseudo, streak, handicap_seconds }
  const [streakHype,      setStreakHype]      = useState(null);   // annonce 5s { pseudo, streak, handicap }
  // Mode de quiz courant — préférence MÉMORISÉE PAR COMPTE (cf. effet plus bas).
  // Défaut neutre 'pvp' avant chargement du profil ; un nouveau compte est basculé
  // en 'beginner' à sa première connexion (welcome_given falsy).
  const [quizMode,        setQuizMode]        = useState('pvp');
  const [showRules,       setShowRules]       = useState(false);
  const modePrefUserRef = useRef(null);   // id du compte pour lequel la préférence a été appliquée
  const [goldFlash,       setGoldFlash]       = useState(null);
  const openDiscord = () => {
    window.open(DISCORD_URL, '_blank', 'noopener,noreferrer');
  };

  // ── Shiny Day banner ── null | { mode:'teaser', d, h, m, s } | { mode:'active' }
  const [shinyDayBanner, setShinyDayBanner] = useState(null);
  useEffect(() => {
    const sd = gs.limits.shinyDay;
    if (!sd || !sd.active || !sd.date || !Array.isArray(sd.slots) || !sd.slots.length) {
      setShinyDayBanner(null); return;
    }
    const firstStart = sd.slots.reduce((mn, s) => s.start < mn ? s.start : mn, '99:99');
    const lastEnd = sd.slots.reduce((mx, s) => s.end > mx ? s.end : mx, '00:00');
    const dayStartMs = new Date(`${sd.date}T${firstStart}:00`).getTime();
    const dayEndMs = new Date(`${sd.date}T${lastEnd}:00`).getTime();
    const rates = sd.slots.map(s => Math.round((s.rate ?? 0) * 100)).filter(r => r > 0);
    const minRate = rates.length ? Math.min(...rates) : 0;
    const maxRate = rates.length ? Math.max(...rates) : 0;
    const tick = () => {
      const now = Date.now();
      if (now < dayStartMs) {
        const diff = dayStartMs - now;
        setShinyDayBanner({
          mode: 'teaser',
          d: Math.floor(diff / 86400000),
          h: Math.floor((diff % 86400000) / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
        });
      } else if (now < dayEndMs) {
        const diff = dayEndMs - now;
        setShinyDayBanner({
          mode: 'active',
          minRate, maxRate,
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
        });
      } else {
        setShinyDayBanner(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gs.limits.shinyDay]);

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!showAdmin) return
    // Rediriger les non-admins qui arrivent sur /admin (accès direct par URL)
    if (auth.profile && auth.profile.role !== 'admin') {
      setShowAdmin(false)
      window.history.replaceState({}, '', '/')
      return
    }
    if (!auth.profile) return
    apiAdminGetQuestions().then(({ data }) => {
      if (data?.questions) setQuestions(data.questions.map(q => ({
        id: q.id, q: q.question, a: q.answer, hint: q.hint || '', active: q.active, hidden: !!q.hidden, translations: q.translations || {}, alt_answers: q.alt_answers || []
      })))
    })
  }, [showAdmin, auth.profile])

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

  // ── Hauteur du header sticky — sert d'offset au bandeau figé de la collection
  // (onglets de types + barre de recherche) qui se cale juste en dessous.
  // ResizeObserver et non un simple resize : le contenu du header change après
  // coup (nav desktop montée à la connexion, devises, polices chargées) et une
  // mesure unique au mount laissait un offset trop court → le bandeau glissait
  // sous le menu. ─────────────────────────────────────────────────────────────
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(48)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setHeaderH(el.offsetHeight || 48)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [auth.profile?.id, isMobile])

  // ── Navigation mobile (onglets) ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('geocoins_tab')
    const wide  = typeof window !== 'undefined' && window.innerWidth >= 640
    return wide ? 'collection' : (saved || 'home')
  })
  useEffect(() => { localStorage.setItem('geocoins_tab', activeTab) }, [activeTab])
  useEffect(() => { gs.marketOpenRef.current = activeTab === 'market' }, [activeTab])

  // Fetch offre du jour + dépôt d'attente quand le profil est chargé ou quand on ouvre l'onglet Trésors
  useEffect(() => {
    if (!auth.profile || auth.isDemo) return  // démo : pas de trésor/dépôt (routes verrouillées)
    apiGetDailyTreasure().then(({ data }) => { if (data) setDailyOffer(data) })
    apiGetHold().then(({ data }) => {
      setHolds(data?.holds ?? [])
      setHoldSlots(data?.slots_unlocked ?? 0)
      setHoldRentActive(!!data?.rent_active)
    })
  }, [auth.profile?.id, activeTab === 'tresors'])

  // Vérifier la saison en cours à la connexion — afficher la popup si nouvelle saison
  useEffect(() => {
    if (!auth.profile || auth.isDemo) return
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
    isDemo: auth.isDemo,
    limits: gs.limits,
    earnGoldWithFx,
    earnCard: gs.earnCard,
    showToast,
    showGoldFlash,
    t,
    onStreakUpdate: gs.setStreak,
    onStreakLeader: setStreakLeader,
    onQuizEnd: () => setQuizSessionActive(false),
    cardPool: gs.cardPool,
    checkAchievements: gs.checkAchievements,
    checkAchievementUpgrades: gs.checkAchievementUpgrades,
    onForgePointsEarned: gs.addForgePoints,
    onGoldSync: gs.setGold,   // dépôt payant (location à la volée) : le serveur renvoie le nouveau solde
  })
  const { countdown, setNextQuizTime, cycleSec, applyServerSchedule, pendingQuiz, setPendingQuiz, activeQuiz, setActiveQuiz,
    nextCard, setNextCard, nextQuizRarity, setNextQuizRarity, holdOffer, setHoldOffer,
    history, setHistory, quizKey, setQuizKey,
    lostToWinner, setLostToWinner,
    lostToGlory, setLostToGlory,
    activeQuizRef, pendingQuizRef, snoozedUntilRef, nextQuizTimeRef,
    advanceQuiz, handleJoin, handleSkip, handleQuizAnswer, handleQuizExpire, handleCloseActiveQuiz } = quiz

  // Rafraîchir l'état du dépôt à l'ouverture de la HoldModal (boutons store/location à jour)
  useEffect(() => {
    if (holdOffer && auth.profile && !auth.isDemo) refreshHold()
  }, [!!holdOffer])

  // ── Mode Débutant (piste parallèle) ─────────────────────────────────────────
  const beginnerActive = quizMode === 'beginner' && !auth.isDemo && !!auth.profile
  const beginner = useBeginnerQuiz({
    profile: auth.profile,
    active: beginnerActive,
    earnGoldWithFx,
    earnCard: gs.earnCard,
    showToast,
    t,
    cardPool: gs.cardPool,
    checkAchievements: gs.checkAchievements,
    checkAchievementUpgrades: gs.checkAchievementUpgrades,
    refreshProfile: () => {
      import('./services/api.js').then(({ apiGetProfile }) => apiGetProfile?.().then(({ data }) => {
        if (data?.profile) auth.setProfile(data.profile)
      })).catch(() => {})
    },
  })
  const beginnerRef = useRef(beginner)
  useEffect(() => { beginnerRef.current = beginner })
  // Ref lu par les handlers socket PvP (figés sur [profile.id]) pour taire son/push/toasts
  // du mode compétitif quand l'utilisateur est en mode Entraînement (piste débutant).
  const beginnerActiveRef = useRef(beginnerActive)
  useEffect(() => { beginnerActiveRef.current = beginnerActive })
  const [beginnerWinnersPopup, setBeginnerWinnersPopup] = useState(null)   // { card, winners }
  // ── Protection inter-modes — AUTORITÉ SERVEUR UNIQUE ────────────────────────
  // Le serveur calcule cross_blocked dans /current (round-based : bloque la manche
  // en cours / la prochaine au moment du gain, puis se libère après une manche ;
  // jamais déclenché par un vieux gain). Le client ne fait que REFLÉTER ce flag —
  // aucune heuristique locale. On n'interroge /current que si on a gagné en dernier
  // dans l'AUTRE mode (= seul cas où le serveur peut bloquer ; sinon il répond false).
  const lastWinMode = auth.profile?.last_geocoin_mode
  const otherMode   = beginnerActive ? 'pvp' : 'beginner'
  const crossEligible = !auth.isDemo && !!auth.profile?.id && lastWinMode === otherMode
  const [crossBlocked, setCrossBlocked] = useState(false)
  const [crossChecking, setCrossChecking] = useState(false)
  const crossServedRef = useRef(false)   // pénalité purgée pour ce gain → ne plus interroger
  useEffect(() => { crossServedRef.current = false }, [auth.profile?.last_geocoin_at])  // ré-arme à chaque nouveau gain
  useEffect(() => {
    if (!crossEligible || crossServedRef.current) { setCrossBlocked(false); setCrossChecking(false); return }
    let cancelled = false, first = true, timer
    const check = async () => {
      if (first) setCrossChecking(true)
      const api = await import('./services/api.js').catch(() => null)
      const fn = beginnerActive ? api?.apiGetBeginnerQuiz : api?.apiGetCurrentQuiz
      const { data } = (fn ? await fn().catch(() => ({ data: null })) : { data: null })
      if (cancelled) return
      const blocked = !!data?.cross_blocked
      setCrossBlocked(blocked)
      if (first) { setCrossChecking(false); first = false }
      // Première réponse non bloquée → pénalité absente ou déjà purgée : on arrête.
      if (!blocked) { crossServedRef.current = true; clearInterval(timer) }
    }
    check()
    timer = setInterval(check, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [crossEligible, beginnerActive])
  const crossBlockMsg = (crossBlocked || crossChecking)
    ? (t('beginner_cross_block') || 'Vous avez déjà gagné un geocoin en mode {mode}, vous pourrez jouer la prochaine manche.')
        .replace('{mode}', t(otherMode === 'pvp' ? 'mode_pvp' : 'mode_beginner'))
    : ''

  // Préférence de mode PAR COMPTE :
  //   - choix déjà mémorisé pour ce compte → on le restaure
  //   - sinon : nouveau compte (welcome_given falsy) → Débutant ; compte existant → PVP
  // Le choix est ensuite persisté (effet suivant) à chaque bascule.
  useEffect(() => {
    const id = auth.profile?.id
    if (!id || auth.isDemo) return
    if (modePrefUserRef.current === id) return
    modePrefUserRef.current = id
    let saved = null
    try { saved = localStorage.getItem(`gc_quiz_mode_${id}`) } catch { /* ignore */ }
    if (saved === 'beginner' || saved === 'pvp') { setQuizMode(saved); return }
    const def = auth.profile.welcome_given ? 'pvp' : 'beginner'   // nouveau compte → Débutant
    setQuizMode(def)
    try { localStorage.setItem(`gc_quiz_mode_${id}`, def) } catch { /* ignore */ }
  }, [auth.profile?.id, auth.isDemo])

  // Mémoriser le choix de l'utilisateur (par compte), une fois la préférence appliquée.
  useEffect(() => {
    const id = auth.profile?.id
    if (!id || auth.isDemo || modePrefUserRef.current !== id) return
    try { localStorage.setItem(`gc_quiz_mode_${id}`, quizMode) } catch { /* ignore */ }
  }, [quizMode, auth.profile?.id, auth.isDemo])

  // Démo : forcer le PVP (le sélecteur de mode est masqué pendant le parcours invité).
  useEffect(() => { if (auth.isDemo && quizMode !== 'pvp') setQuizMode('pvp') }, [auth.isDemo, quizMode])

  // Une modale de quiz est-elle ouverte (PVP ou Débutant) ? — pour masquer la barre.
  const anyActiveQuiz = activeQuiz || beginner.activeQuiz
  // Barre de quiz du mode courant, précédée d'un petit bouton de bascule (à gauche).
  const renderQuizBar = () => {
    const bar = beginnerActive
      ? (beginner.recap
          ? <BeginnerRecap winners={beginner.recap.winners} secondsLeft={beginner.recapLeft} revealAnswer={beginner.recap.answer} />
          : <BeginnerCountdownWidget secondsLeft={beginner.countdown} cycleTime={beginner.cycleSec} nextCard={beginner.nextCard} hasPendingQuiz={!!beginner.pendingQuiz} alreadyWon={beginner.alreadyWon} onJoin={beginner.handleJoin} owned={!!beginner.nextCard && (gs.collection?.[beginner.nextCard.id] || 0) > 0} />)
      : <CountdownWidget secondsLeft={countdown} cycleTime={cycleSec} nextCard={nextCard} nextQuizRarity={nextQuizRarity} hasPendingQuiz={!!pendingQuiz && !pendingQuiz.winner && !lostToWinner} lostTo={lostToWinner ?? null} lostToGlory={lostToGlory} onJoin={handleJoin} isShiny={pendingQuiz?.is_shiny ?? quizIsShiny} prizesTotal={pendingQuiz?.prizes_total ?? 1} owned={!!nextCard && ((pendingQuiz?.is_shiny ?? quizIsShiny) ? (gs.shinyCollection?.[nextCard.id] || 0) > 0 : (gs.collection?.[nextCard.id] || 0) > 0)} streakHype={streakHype} streakLeader={streakLeader} graceDeadline={pendingQuiz?.graceDeadline ?? null} />
    // Protection inter-modes : pendant la vérification serveur → chargement ; si bloqué
    // → barre floutée + message + timer. Dans les deux cas, interaction impossible.
    const blockTimer = beginnerActive ? (beginner.recap ? beginner.recapLeft : beginner.countdown) : countdown
    const barWrapped = (crossChecking || crossBlocked) ? (
      <div style={{ position: 'relative' }}>
        <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">{bar}</div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4, padding: '6px 12px', borderRadius: 13, background: 'rgba(14,24,34,0.55)', backdropFilter: 'blur(1px)' }}>
          {crossBlocked ? (<>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#ffd28a', lineHeight: 1.3 }}>🔒 {crossBlockMsg}</div>
            {blockTimer > 0 && <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>⏳ {blockTimer}s</div>}
          </>) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cfd8e3', fontWeight: 800, fontSize: 12 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #cfd8e3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              {t('cross_checking') || 'Vérification…'}
            </div>
          )}
        </div>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    ) : bar
    if (auth.isDemo || !auth.profile) return barWrapped  // démo : pas de bascule de mode
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <ModeToggle mode={quizMode} onChange={setQuizMode} onOpenRules={() => setShowRules(true)} />
        <div style={{ flex: 1, minWidth: 0 }}>{barWrapped}</div>
      </div>
    )
  }

  const streakHypeTimerRef = useRef(null)
  // Ref pour éviter la capture stale de handleQuizExpire dans les handlers socket
  const handleQuizExpireRef = useRef(handleQuizExpire)
  useEffect(() => { handleQuizExpireRef.current = handleQuizExpire }, [handleQuizExpire])
  const advanceQuizRef = useRef(advanceQuiz)
  useEffect(() => { advanceQuizRef.current = advanceQuiz }, [advanceQuiz])
  // Identité courante (id + pseudo) pour les handlers socket : le handler quiz:solved
  // est figé sur le render de setup (deps [profile.id]) → sans ref, auth.profile peut
  // y être périmé et faire croire qu'un AUTRE a gagné (message « trop tard » + soi-même
  // dans l'historique) alors qu'on a gagné. winner_id (id exact) est prioritaire.
  const myIdRef = useRef(auth.profile?.id)
  const myPseudoRef = useRef(auth.profile?.pseudo)
  useEffect(() => { myIdRef.current = auth.profile?.id; myPseudoRef.current = auth.profile?.pseudo }, [auth.profile?.id, auth.profile?.pseudo])

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
    const anyOpen = showAuth || showSettings || showReferral || showAdmin || showMarket || showForge ||
      showLeaderboard || showShop || showTxHistory || showDocs || !!selectedCard ||
      showScoreDetail || !!seasonPopup || !!activeQuiz || !!beginner.activeQuiz || showRules || !!beginnerWinnersPopup
    // NB : ne PAS utiliser `touch-action: none` sur le body — sur iOS Safari cela
    // désactive tous les gestes tactiles du sous-arbre (modals inclus), rendant
    // impossible le scroll DANS le modal et la fermeture au tap. `overflow: hidden`
    // (+ overscroll-behavior) suffit à bloquer le scroll du fond.
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    document.body.style.overscrollBehavior = anyOpen ? 'none' : ''
    return () => { document.body.style.overflow = ''; document.body.style.overscrollBehavior = '' }
  }, [showAuth, showSettings, showReferral, showAdmin, showMarket, showForge, showLeaderboard,
      showShop, showTxHistory, showDocs, selectedCard, showScoreDetail, seasonPopup, activeQuiz,
      beginner.activeQuiz, showRules, beginnerWinnersPopup])

  // ── Market actions with toasts ─────────────────────────────────────────────
  function handleBuy(listing, index) {
    const res = gs.handleBuy(listing, index);
    if (res === 'insufficient') { showToast('Pas assez d\'or ! 💸', 'error'); return; }
    showToast(t('toast_bought').replace('{card}', listing.card.name).replace('{price}', listing.price));
  }
  async function handleListCard(card, price) {
    const error = await gs.handleListCard(card, price, auth.profile?.pseudo || 'Moi');
    if (error) return error;
    showToast(t('toast_listed').replace('{card}', card.name).replace('{price}', price));
    return null;
  }
  // Achat au marché « Hors saison » : débit Gold + PF, ajout collection, popups achievements.
  async function handleBuyOffseason(item) {
    const { data, error } = await apiBuyOffseasonCard(item.card.id)
    if (error) { showToast('❌ ' + error, 'error'); return error }
    gs.earnCard(item.card, false)
    if (typeof data.gold_remaining === 'number') gs.setGold(data.gold_remaining)
    if (typeof data.forge_points_remaining === 'number') gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
    gs.checkAchievements(data.achievements || [])
    gs.checkAchievementUpgrades(data.achievement_upgrades || [])
    gs.triggerQuestRefresh()
    showToast(t('toast_offseason_bought').replace('{card}', item.card.name))
    return null
  }
  async function handleCancelListing(index) {
    const error = await gs.handleCancelListing(index, auth.profile?.pseudo || 'Moi');
    if (error) { showToast('❌ ' + error, 'error'); return; }
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
    // earnGoldWithFx est une fonction locale d'App, PAS un membre de gs :
    // l'appel gs.earnGoldWithFx lançait un TypeError silencieux (promesse non
    // catchée) qui court-circuitait triggerQuestRefresh + toast à chaque claim.
    if (data.gold_earned > 0) earnGoldWithFx(data.gold_earned)
    if (data.forge_points_earned > 0) gs.addForgePoints(data.forge_points_earned)
    gs.triggerQuestRefresh()
    showToast(t('toast_daily_claimed').replace('{card}', data.card.name))
  }

  // ── Recharger l'état du dépôt depuis le serveur ─────────────────────────────
  async function refreshHold() {
    const { data } = await apiGetHold()
    setHolds(data?.holds ?? [])
    setHoldSlots(data?.slots_unlocked ?? 0)
    setHoldRentActive(!!data?.rent_active)
  }

  // ── Réclamer un geocoin précis du dépôt d'attente ───────────────────────────
  async function handleClaimHold(holdId) {
    const claimed = holds.find(h => h.id === holdId)
    const { data, error } = await apiClaimHold(holdId)
    if (error) { showToast(error, 'error'); return }
    setHolds(prev => prev.filter(h => h.id !== holdId))
    if (claimed?.rented) setHoldRentActive(false)
    gs.earnCard(data.card, data.is_shiny || false)
    if (data.forge_points_earned > 0) gs.addForgePoints(data.forge_points_earned)
    gs.triggerQuestRefresh?.()
    showToast(t('toast_hold_claimed').replace('{card}', data.card.name))
  }

  // ── Acheter un emplacement permanent (2 ou 3) ───────────────────────────────
  async function handleBuyHoldSlot() {
    const { data, error } = await apiBuyHoldSlot()
    if (error) { showToast(error, 'error'); return }
    setHoldSlots(data.hold_slots)
    if (typeof data.gold === 'number') gs.setGold(data.gold)
    showToast(t('toast_hold_slot_bought'))
  }

  // ── Louer l'emplacement 4 (temporaire) ──────────────────────────────────────
  async function handleRentHoldSlot() {
    const { data, error } = await apiRentHoldSlot()
    if (error) { showToast(error, 'error'); return }
    setHoldRentActive(true)
    if (typeof data.gold === 'number') gs.setGold(data.gold)
    showToast(t('toast_hold_slot_rented'))
  }

  // ── Agrandir les poches : +N geocoins/heure jusqu'à minuit (cumulable) ──────
  async function handleBuyPocketBoost() {
    const { data, error } = await apiBuyPocketBoost()
    if (error) { showToast(error, 'error'); return }
    if (typeof data.gold === 'number') gs.setGold(data.gold)
    // Mise à jour immédiate du profil : computeCardLimitStatus relit ces champs.
    auth.setProfile(p => p ? { ...p, ...(typeof data.gold === 'number' ? { gold: data.gold } : {}), pocket_boost: data.pocket_boost, pocket_boost_day: data.pocket_boost_day } : p)
    showToast(t('toast_pocket_bought').replace('{n}', data.cards ?? gs.limits?.pocketBoostCards ?? 10))
  }

  // ── Agrandir le sac : +1 geocoin/jour PERMANENT par emplacement (5 max) ─────
  async function handleBuyBagSlot() {
    const { data, error } = await apiBuyBagSlot()
    if (error) { showToast(error, 'error'); return }
    if (typeof data.gold === 'number') gs.setGold(data.gold)
    auth.setProfile(p => p ? { ...p, ...(typeof data.gold === 'number' ? { gold: data.gold } : {}), bag_slots: data.bag_slots } : p)
    showToast(t('toast_bag_bought'))
  }

  // Offre d'agrandissement affichée dans la bannière « limite atteinte » du quiz :
  // prix du boost de poches (limite horaire) et du prochain emplacement de sac
  // (limite quotidienne, null = les 5 emplacements sont achetés).
  const limitUpsell = auth.isDemo ? null : {
    gold:        gs.gold,
    pocketPrice: gs.limits?.pocketBoostPrice ?? 100,
    pocketCards: gs.limits?.pocketBoostCards ?? 10,
    bagPrice: (() => {
      const prices = Array.isArray(gs.limits?.bagSlotPrices) ? gs.limits.bagSlotPrices : []
      const price  = Number(prices[Math.max(0, Number(auth.profile?.bag_slots) || 0)])
      return Number.isFinite(price) ? price : null
    })(),
    onBuyPocket: handleBuyPocketBoost,
    onBuyBag:    handleBuyBagSlot,
  }

  // Wrapper — bloque la soumission pour les non-connectés et propose l'inscription
  // ── Mode démo : alimente les VRAIS CountdownWidget/QuizModal avec un parcours
  // solo (5 geocoins). Réutilise l'état pendingQuiz/activeQuiz de useQuiz (les
  // objets démo n'ont pas d'id → handleJoin n'appelle aucune API quiz globale).
  const [demoSteps, setDemoSteps] = useState(null)
  const [demoSocial, setDemoSocial] = useState(null)   // { pseudos, tribute } pour le faux feed
  const [demoTypeTotals, setDemoTypeTotals] = useState(null)  // [{type,total}] vrais totaux par type (onglets démo)
  const demoStartedRef = useRef(false)
  const demoDone  = demoSteps ? demoSteps.filter(s => s.earned).length : 0
  // Démo terminée : les 5 geocoins gagnés → on remplace la barre par l'invitation à s'inscrire.
  const demoComplete = !!(auth.isDemo && demoSteps && demoSteps.length > 0 && demoSteps.every(s => s.earned))

  const buildDemoQuiz = useCallback((step) => {
    if (!step) return null
    const poolCard = gs.cardPool.find(c => c.id === step.card?.id) || {}
    const card = { ...step.card, ...poolCard, sellable: false, minPrice: null, desc: '' }
    const tr = step.translations?.[getLang()]
    const wc = step.answer_word_count || 1
    // _q : données de validation (réponses) embarquées → la démo valide côté client.
    return { _demoStep: step.step, _q: { answer: step.answer, alt_answers: step.alt_answers, translations: step.translations }, id: undefined, card, q: tr?.question || step.question, a: Array(wc).fill('x').join(' '), h: step.hint, is_shiny: false, started_at: new Date().toISOString() }
  }, [gs.cardPool])

  const presentDemoStep = useCallback((steps) => {
    setActiveQuiz(null); activeQuizRef.current = null
    const next = (steps || []).find(s => !s.earned)
    if (!next) { setPendingQuiz(null); setNextCard(null); return }  // fini → DemoComplete (dérivé) remplace la barre
    const q = buildDemoQuiz(next)
    setPendingQuiz(q); setNextCard(q.card)
  }, [buildDemoQuiz, setActiveQuiz, activeQuizRef, setPendingQuiz, setNextCard])

  useEffect(() => {
    if (!auth.isDemo || demoStartedRef.current) return
    demoStartedRef.current = true
    let cancelled = false
    // Retry si l'appel échoue / renvoie vide, pour éviter une démo bloquée vide.
    const load = (attempt = 0) => {
      apiGetDemo().then(({ data }) => {
        if (cancelled) return
        const rawSteps = data?.steps || []
        if (!rawSteps.length) { if (attempt < 4) setTimeout(() => load(attempt + 1), 1500); return }
        // Progression « gagnés » reprise depuis le navigateur (localStorage).
        const earnedIds = new Set(readDemoEarned())
        const steps = rawSteps.map(s => ({ ...s, earned: earnedIds.has(s.card?.id) }))
        const seen = new Set()
        gs.setCardPool(steps.map(s => s.card).filter(c => c && !seen.has(c.id) && seen.add(c.id)))
        const earned = {}
        for (const s of steps) if (s.earned && s.card) earned[s.card.id] = 1
        gs.setCollection(earned)
        gs.setQuests(DEMO_QUESTS)
        setDemoTypeTotals(data?.type_totals || [])
        setDemoSocial({ pseudos: data?.social?.pseudos || [], tribute: data?.social?.tribute || [] })
        setDemoSteps(steps)
        presentDemoStep(steps)
      }).catch(() => { if (!cancelled && attempt < 4) setTimeout(() => load(attempt + 1), 1500) })
    }
    load()
    return () => { cancelled = true }
  }, [auth.isDemo])

  // Quitter la démo (connexion) réarme le contrôleur : si l'utilisateur se déconnecte
  // ensuite, la démo se recharge proprement.
  useEffect(() => { if (!auth.isDemo) demoStartedRef.current = false }, [auth.isDemo])

  // Fermeture du quiz démo (après victoire) → étape suivante ou mur d'inscription.
  const demoAdvance = useCallback(() => {
    setActiveQuiz(null); activeQuizRef.current = null
    setDemoSteps(prev => { presentDemoStep(prev); return prev })
  }, [presentDemoStep, setActiveQuiz, activeQuizRef])

  // Réponse au quiz démo : validation 100% navigateur (réponses embarquées dans _q),
  // geocoin mémorisé en localStorage (crédité au vrai compte plus tard via /claim).
  const demoAnswer = useCallback(async (userAnswer) => {
    const aq = activeQuizRef.current
    const stepIdx = aq?._demoStep
    if (stepIdx == null) return 'error'
    if (!isCorrectAnswer(aq._q, userAnswer)) return false  // mauvaise réponse
    const cardId = aq.card?.id
    if (cardId != null) writeDemoEarned([...readDemoEarned(), cardId])
    gs.earnCard(aq.card, false)
    setDemoSteps(prev => (prev || []).map((s, i) => (i === stepIdx ? { ...s, earned: true } : s)))
    // Pas de socket en démo : on referme le résultat et on enchaîne nous-mêmes
    // (le vrai jeu le fait via quiz:solved). Délai = temps de voir « Bonne réponse ».
    setTimeout(() => demoAdvance(), 2200)
    return { ok: true, outcome: 'card', forge: 0 }
  }, [activeQuizRef, gs, demoAdvance])

  // Démo : rester sur la collection (onglets marché/forge/trésor/top restreints).
  useEffect(() => {
    if (auth.isDemo && ['market', 'forge', 'tresors', 'top'].includes(activeTab)) setActiveTab('collection')
  }, [auth.isDemo, activeTab])

  // Création/connexion d'un vrai compte avec des geocoins démo en localStorage →
  // on les crédite à l'inventaire (filtrés serveur), puis on efface le localStorage
  // et on rafraîchit la collection. Couvre email et OAuth (retour de redirection).
  const demoClaimedRef = useRef(false)
  useEffect(() => {
    if (!auth.user || demoClaimedRef.current) return
    const ids = readDemoEarned()
    if (!ids.length) { demoClaimedRef.current = true; return }
    demoClaimedRef.current = true
    apiDemoClaim(ids)
      .then(({ data }) => {
        clearDemoEarned()
        // Fusion optimiste (loadAll rechargera la collection serveur après login).
        if (data?.credited?.length) {
          gs.setCollection(prev => {
            const next = { ...prev }
            for (const id of data.credited) next[id] = next[id] || 1
            return next
          })
        }
      })
      .catch(() => { demoClaimedRef.current = false })  // réessayer au prochain rendu si échec réseau
  }, [auth.user?.id])

  // Démo : faux feed « derniers geocoins disputés », rotatif toutes les 60 s
  // (pseudos du top × geocoins hommage), alimente le VRAI strip d'historique.
  useEffect(() => {
    if (!auth.isDemo || !demoSocial) return
    const refresh = () => setHistory(buildDemoHistory(demoSocial.pseudos, demoSocial.tribute))
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [auth.isDemo, demoSocial, setHistory])

  const wrappedHandleQuizAnswer = async (_userAnswer, _choice, _holdAction) => {
    if (!auth.profile) {
      setShowRegisterPrompt(true)
      return false
    }
    // Démo : ne pas passer par le quiz global, valider côté client (sans compte).
    if (auth.isDemo) return demoAnswer(_userAnswer)
    const result = await handleQuizAnswer(_userAnswer, _choice, _holdAction)
    // Dépôt effectué (location/remplacement/slot) : le contenu du dépôt a changé →
    // resynchroniser pour que le prochain sélecteur affiche les bons geocoins/prix.
    if (result?.outcome === 'hold') refreshHold()
    // Filet de sécurité (course rare avant le 1er poll) : un refus serveur affiche le
    // blocage ; le poll /current confirmera/effacera ensuite.
    if (result === 'blocked') { crossServedRef.current = false; setCrossBlocked(true) }
    // Resynchroniser le profil (gold, daily_*, forge_points...) après la réponse
    if (import.meta.env.VITE_API_URL) {
      const { apiGetProfile } = await import('./services/api.js').catch(() => ({}))
      apiGetProfile?.().then(({ data }) => {
        if (data?.profile) auth.setProfile(data.profile)
      }).catch(() => {})
    }
    // Sur une victoire, rafraîchir la progression des achievements (ex. « Roi du
    // savoir » qui s'incrémente à chaque quiz gagné) sans attendre un rechargement.
    if (result?.ok) gs.refreshAchievements?.()
    return result
  }

  // Réponse Entraînement : filet de sécurité si un refus serveur précède le 1er poll.
  const wrappedBeginnerAnswer = async (ans) => {
    const result = await beginner.handleAnswer(ans)
    if (result === 'blocked') { crossServedRef.current = false; setCrossBlocked(true) }
    return result
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
    if (auth.isDemo) return  // démo : pas d'onboarding pseudo/cadeau (parcours dédié)
    if (auth.profile.welcome_given) {
      // Utilisateur existant : proposer un pseudo propre si celui hérité du
      // fournisseur OAuth contient espace/@/. — MAIS une seule fois. Dès que le
      // joueur (ou un admin) a fait un choix délibéré (pseudo_changed_at posé),
      // on n'invite plus jamais, sinon il ressaisit son pseudo à chaque connexion.
      const providers = auth.user?.app_metadata?.providers || []
      const isOAuth = providers.includes('google') || providers.includes('github')
      const alreadyAsked = (() => { try { return localStorage.getItem(`geocoins_pseudo_prompt_done_${auth.profile.id}`) === '1' } catch { return false } })()
      if (isOAuth && !auth.profile.pseudo_changed_at && !alreadyAsked) {
        const p = auth.profile.pseudo || ''
        if (p.includes(' ') || p.includes('@') || p.includes('.')) setShowChoosePseudo(true)
      }
      return
    }
    // Nouvel utilisateur : commencer par le choix du pseudo — sauf s'il l'a déjà
    // choisi (pseudo_changed_at posé) mais a quitté avant la fin du tuto : on
    // reprend alors directement au cadeau, sinon il ressaisit son pseudo à chaque
    // connexion tant que welcome_given (posé en fin de tuto) reste faux.
    if (onboardingStep !== null) return
    setOnboardingStep(auth.profile.pseudo_changed_at ? 'gift' : 'pseudo')
  }, [auth.profile?.id])

  // Étape 'gift' : récupérer la carte de bienvenue + horodatage d'entrée
  const giftEnteredAtRef = useRef(0)
  useEffect(() => {
    if (onboardingStep !== 'gift') return
    giftEnteredAtRef.current = Date.now()
    let cancelled = false
    const run = async () => {
      const { apiWelcomeCard, apiOnboardingDone } = await import('./services/api.js')
      const { data } = await apiWelcomeCard()
      if (cancelled) return
      const newCards = data?.cards || []
      if (newCards.length > 0) {
        newCards.forEach(c => gs.setCollection(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 })))
        setWelcomeCards(newCards)
      }
      setOnboardingCardReady(true)
      // Onboarding acquis dès le pseudo + la carte de bienvenue : on persiste
      // welcome_given maintenant pour ne jamais rejouer tout le flux si le joueur
      // quitte avant la fin du tuto (le tour reste affiché cette session).
      apiOnboardingDone?.().catch(() => {})
      auth.setProfile(p => p ? { ...p, welcome_given: true } : p)
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
      setOnboardingStep(welcomeCards.length > 0 ? 'card' : (seasonPopup ? 'season' : 'tour'))
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
        if (showReferral)       { setShowReferral(false); return }
        if (showAuth)           { setShowAuth(false); return }
        if (showTxHistory)      { setShowTxHistory(false); return }
        if (showAdmin)          { setShowAdmin(false); window.history.pushState({}, '', '/'); return }
        if (showShop)           { setShowShop(false); return }
        if (menuOpen)           { setMenuOpen(false); return }
      }
      if (e.key === 'Enter' && pendingQuiz && !activeQuiz) { handleJoin(); return }
      if (e.key === 'm' && !e.ctrlKey) { setActiveTab(t => t === 'market' ? 'collection' : 'market'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCard, activeTab, showSettings, showReferral, showAuth,
      showTxHistory, showAdmin, showShop, menuOpen, pendingQuiz, activeQuiz])


  // Bannière déblocage marché — seulement pour les non-connectés au premier doublon
  const hasDuplicate = useMemo(
    () => Object.values(gs.collection).some(n => n > 1),
    [gs.collection]
  )
  const userScore = useMemo(
    () => collScore(gs.collection, gs.cardPool, gs.shinyCollection || {}, gs.limits.scoreRules, gs.limits.shinyScoreRules),
    [gs.collection, gs.cardPool, gs.shinyCollection, gs.limits.scoreRules, gs.limits.shinyScoreRules]
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
  // Démo : cardPool ne contient que le type jouable. On affiche TOUS les vrais types
  // (vrais totaux fournis par le backend) ; seuls les types présents dans la démo sont
  // consultables, les autres invitent à se connecter.
  const demoUnlockedTypes = useMemo(
    () => new Set((demoSteps || []).map(s => s.card?.type).filter(Boolean)),
    [demoSteps]
  );
  // Achievements évolutifs : une série = 4 cartes-variantes (commun→légendaire)
  // mais ne doit compter et s'afficher que pour UN geocoin — celui du palier
  // courant (ou le commun si pas encore débloqué). On masque les autres variantes
  // de la grille et des totaux. La progression réelle (collection/score) ne porte
  // déjà que la variante possédée ; ceci ne touche que l'affichage et le dénominateur.
  const evolutiveHiddenIds = useMemo(() => {
    const hide = new Set()
    const seenSeries = new Set()
    for (const info of Object.values(gs.achievementProgress || {})) {
      if (!info?.tiers) continue
      const key = info.tiers.map(t => t.card_id || 0).join(',')
      if (seenSeries.has(key)) continue
      seenSeries.add(key)
      const tier = info.tier || 0
      // Variante active = la carte définie la plus haute au palier atteint. Les
      // séries évolutives incomplètes (paliers sans carte, ex. « Légendaire » qui
      // n'a que la variante commune) ne doivent jamais faire disparaître la série :
      // on se replie vers le bas, puis sur la 1ʳᵉ carte définie. Sans ce repli,
      // un palier sans carte rendait activeId indéfini et masquait TOUTES les
      // variantes → la série manquait dans « Tous » et l'onglet « Achievements ».
      let activeId = null
      for (let i = Math.min(tier, info.tiers.length) - 1; i >= 0; i--) {
        if (info.tiers[i]?.card_id) { activeId = info.tiers[i].card_id; break }
      }
      if (!activeId) activeId = info.tiers.find(t => t.card_id)?.card_id || null
      if (!activeId) continue
      for (const tt of info.tiers) if (tt.card_id && tt.card_id !== activeId) hide.add(tt.card_id)
    }
    return hide
  }, [gs.achievementProgress])
  const visibleCardPool = useMemo(
    () => gs.cardPool.filter(c => !evolutiveHiddenIds.has(c.id)),
    [gs.cardPool, evolutiveHiddenIds]
  )

  const typeTabs = useMemo(() => {
    if (auth.isDemo && demoTypeTotals?.length) {
      // « Tous » = total de TOUS les geocoins, achievements compris.
      const grand = demoTypeTotals.reduce((s, x) => s + (x.total || 0), 0);
      const ownedOf = tp => ((tp === 'Tous' || demoUnlockedTypes.has(tp))
        ? gs.cardPool.filter(c => (tp === 'Tous' || c.type === tp) && (gs.collection[c.id] || 0) > 0).length
        : 0);
      return [
        // « Tous » est jouable : même contenu que le type démo (cardPool = geocoins démo).
        { type: 'Tous', total: grand, owned: ownedOf('Tous'), locked: false },
        ...demoTypeTotals.map(x => ({ type: x.type, total: x.total, owned: ownedOf(x.type), locked: !demoUnlockedTypes.has(x.type) })),
      ];
    }
    return types.map(tp => {
      const pool  = tp === 'Tous' ? visibleCardPool.filter(c => c.rarity !== 'achievement' && c.type !== 'Achievement') : visibleCardPool.filter(c => c.type === tp);
      const total = pool.length;
      const owned = showShiny
        ? pool.filter(c => (gs.shinyCollection?.[c.id] || 0) > 0).length
        : pool.filter(c => (gs.collection[c.id] || 0) > 0).length;
      return { type: tp, total, owned, locked: false };
    });
  }, [auth.isDemo, demoTypeTotals, demoUnlockedTypes, types, gs.cardPool, visibleCardPool, gs.collection, gs.shinyCollection, showShiny]);
  // Onglet courant verrouillé en démo : tout sauf « Tous » et le type jouable.
  const currentTabLocked = auth.isDemo && demoTypeTotals?.length > 0 && filter !== 'Tous' && !demoUnlockedTypes.has(filter);
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
      // Si showMissing (ou vue d'ensemble) actif en mode shiny : montrer aussi les cartes possédées sans shiny
      if (showMissing || collViewAll) {
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
    // En démo : toujours afficher les 5 geocoins du parcours, les non-gagnés en
    // « manquant » (cardPool ne contient que ces 5).
    let normalList;
    if (showMissing || collViewAll || auth.isDemo) {
      normalList = visibleCardPool
        .filter(c => (af || c.type === filter) && matchSearch(c))
        .map(c => ({ card: c, count: gs.collection[c.id] || 0, missing: !(gs.collection[c.id] > 0) }))
    } else {
      normalList = Object.entries(gs.collection)
        .filter(([, v]) => v > 0)
        .map(([id, cnt]) => ({ card: gs.cardPool.find(c => c.id === +id), cnt, missing: false }))
        .filter(x => x.card && (af || x.card.type === filter) && matchSearch(x.card))

      // Sur l'onglet "Achievements" uniquement, afficher aussi les manquants
      // même sans le toggle "Manquants" (pas dans "Tous" ni les autres onglets)
      if (filter?.toLowerCase().startsWith('achievement')) {
        const missingAch = visibleCardPool
          .filter(c => c.type === filter && !(gs.collection[c.id] > 0))
          .filter(matchSearch)
          .map(c => ({ card: c, cnt: 0, missing: true }))
        normalList = [...normalList, ...missingAch]
      }
    }
    return normalList.sort(sortFn)
  }, [showMissing, collViewAll, showShiny, sortBy, filter, cardSearch, auth.isDemo, gs.collection, gs.cardPool, visibleCardPool, gs.shinyCollection]);

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
  const validPaths = ['/', '/support', '/faq', '/release-notes', '/admin']
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
        @keyframes popIn    { from{opacity:0;transform:scale(.92) translateY(16px)} to{opacity:1;transform:none} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardSort { 0%{opacity:0;transform:scale(.88) translateY(6px)} 60%{transform:scale(1.03) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeLeft { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ── Toast hors-ligne ── (pas en démo : aucun socket attendu) */}
      {!socketOnline && import.meta.env.VITE_API_URL && !auth.isDemo && (
        <div style={{ flexShrink: 0, background: '#d63031', color: '#fff', textAlign: 'center', padding: '7px 16px', fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>
          {t('server_offline')}
        </div>
      )}

      {/* ── Bannière Journée Brillante ── */}
      {shinyDayBanner && (
        <>
          <style>{`
            @keyframes bannerSparkle {
              0%,100% { opacity:0; transform:scale(0) rotate(0deg); }
              50%     { opacity:1; transform:scale(1) rotate(180deg); }
            }
          `}</style>
          <div style={{
            position: 'relative', flexShrink: 0, overflow: 'hidden',
            background: '#0c1620',
            color: theme.gold, textAlign: 'center', padding: '7px 16px',
            fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {[...Array(10)].map((_, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: `${(i / 10) * 100}%`,
                top: `${15 + (i % 3) * 28}%`,
                fontSize: 8 + (i % 3) * 2,
                color: theme.gold,
                opacity: 0.25,
                animation: `bannerSparkle 2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                pointerEvents: 'none', zIndex: 1,
              }}>✦</span>
            ))}
            <span style={{ position: 'relative', zIndex: 2 }}>
              {shinyDayBanner.mode === 'active'
                ? t('shiny_event_banner')
                    .replace('{min}', shinyDayBanner.minRate)
                    .replace('{max}', shinyDayBanner.maxRate)
                    .replace('{h}', String(shinyDayBanner.h).padStart(2, '0'))
                    .replace('{m}', String(shinyDayBanner.m).padStart(2, '0'))
                    .replace('{s}', String(shinyDayBanner.s).padStart(2, '0'))
                : t('shiny_event_teaser')
                    .replace('{d}', shinyDayBanner.d)
                    .replace('{h}', String(shinyDayBanner.h).padStart(2, '0'))
                    .replace('{m}', String(shinyDayBanner.m).padStart(2, '0'))
                    .replace('{s}', String(shinyDayBanner.s).padStart(2, '0'))}
            </span>
          </div>
        </>
      )}

      {/* ACCENT BAR */}
      {!shinyDayBanner && <div style={{ height: 3, background: 'linear-gradient(90deg,#58a6ff,#bc8cff,#f9ca24,#f85149)', flexShrink: 0 }} />}

      {/* ── HEADER ── */}
      <header ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 200, background: theme.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${theme.border}`, padding: isMobile ? '9px 10px' : '9px 20px', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0 }}>
        <Logo iconSize={isMobile ? 26 : 30} textSize={isMobile ? 15 : 19} />

        {/* Desktop tab nav — même style que mobile, centré dans le header */}
        {isWide && auth.profile ? (
          <>
            <div style={{ flex: 1 }} />
            <nav style={{ display: 'flex' }}>
              {[
                { id: 'tresors',    icon: '💎', label: t('nav_tresors'), badge: dailyOffer && !dailyOffer.claimed ? 1 : 0, disabled: auth.isDemo || gs.limits.featureTresor === false, tour: 'nav-tresors' },
                { id: 'collection', icon: '🃏', label: t('nav_collection'), tour: 'nav-collection' },
                { id: 'market',     icon: '🏪', label: t('nav_market'), badge: gs.unreadSales, tour: 'nav-market', disabled: auth.isDemo || gs.limits.featureMarket === false},
                ...(gs.cardPool.some(c => c.forgeable) || gs.limits.shinyForgeOpen !== false ? [{ id: 'forge', icon: '🔨', label: t('nav_forge'), tour: 'nav-forge', disabled: auth.isDemo || gs.limits.featureForge === false }] : []),
                { id: 'top',        icon: '🏆', label: t('nav_top'), tour: 'nav-top', disabled: auth.isDemo || gs.limits.featureLeaderboard === false },
              ].map(tb => {
                const active = activeTab === tb.id
                return (
                  <button key={tb.id} onClick={() => tb.disabled ? (auth.isDemo && setDemoInfo(tb.id)) : setActiveTab(tb.id)}
                    data-tour={tb.tour}
                    style={{ position: 'relative', background: 'none', border: 'none', color: tb.disabled ? theme.textMuted : active ? '#f9ca24' : theme.headerMuted, padding: '6px 18px 8px', cursor: (tb.disabled && !auth.isDemo) ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontFamily: "'Nunito',sans-serif", transition: 'color .15s', opacity: tb.disabled ? 0.45 : 1 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{tb.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .3 }}>{tb.label}</span>
                    {tb.disabled && <span style={{ fontSize: 7, fontWeight: 800, color: '#e74c3c', letterSpacing: .2, whiteSpace: 'nowrap' }}>{auth.isDemo ? t('tab_signin') : t('coming_soon')}</span>}
                    {!tb.disabled && tb.badge > 0 && <span style={{ position: 'absolute', top: 4, left: '55%', background: '#e74c3c', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.badgeBorder}` }}>{tb.badge > 9 ? '9+' : tb.badge}</span>}
                    {!tb.disabled && active && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#f9ca24', borderRadius: '3px 3px 0 0' }} />}
                  </button>
                )
              })}
            </nav>
            <div style={{ flex: 1 }} />
          </>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Currencies (mobile only — desktop shows in sidebar profile)
            Masquées en démo : header type « non connecté » (sinon elles tronquent « Se connecter »). */}
        {auth.profile && !auth.isDemo && isMobile && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
            <div data-tour="gold" style={{ flexShrink: 0, background: '#f9ca2410', border: '1px solid #f9ca2428', borderRadius: 20, padding: '5px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: theme.gold }}>{gs.gold}<span style={{ fontWeight: 500, fontSize: 11, opacity: .6 }}>G</span></span>
            </div>
            {gs.forgePoints > 0 && (
              <div style={{ flexShrink: 0, background: '#a29bfe10', border: '1px solid #a29bfe28', borderRadius: 20, padding: '5px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>🔨</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#a29bfe' }}>{gs.forgePoints}</span>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle — connecté uniquement (pas en démo : header type « non connecté ») */}
        {auth.profile && !auth.isDemo && <button onClick={toggle} title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={{ background: 'none', border: `1px solid ${theme.headerMuted}44`, color: theme.headerMuted, width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>}

        {/* Avatar — masqué en démo : on affiche barre de langue + « Se connecter » (comme non connecté) */}
        {auth.profile && !auth.isDemo ? (
          <div style={{ position: 'relative' }} ref={avatarMenuRef}>
            <button onClick={() => setAvatarMenu(v => !v)} style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: '2px solid #f9ca2444', cursor: 'pointer', fontSize: 13, fontWeight: 900, color: '#1a2538', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {auth.profile.pseudo[0].toUpperCase()}
              {hasReleaseNotif && <span style={{ position: 'absolute', top: -2, left: -2, background: '#6c5ce7', borderRadius: '50%', width: 10, height: 10, border: `1.5px solid ${theme.badgeBorder}`, boxShadow: '0 0 6px #6c5ce7' }} />}
            </button>
            {avatarMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 16px 48px #000d', zIndex: 99999, minWidth: 200, overflow: 'hidden', fontFamily: "'Nunito',sans-serif" }}>
                <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${theme.borderLight}` }}>
                  <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5, paddingLeft: 4 }}>{t('menu_language')}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Object.entries(LANGS).map(([code, label]) => (
                      <button key={code} onClick={() => setLang(code)} style={{ background: lang === code ? '#f9ca2420' : theme.bgElevated, border: lang === code ? '1px solid #f9ca2444' : `1px solid ${theme.border}`, color: lang === code ? '#f9ca24' : theme.textSecondary, padding: '3px 9px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>{label}</button>
                    ))}
                  </div>
                </div>
                <VolumeControl />
                {[
                  // Compte invité (démo) : pas de « Mon compte » ni de parrainage (pas de vrai compte).
                  ...(auth.isDemo ? [] : [
                    { icon: '👤', label: t('menu_account') || 'Mon compte', fn: () => { setShowSettings(true); setAvatarMenu(false) } },
                    { icon: '🤝', label: t('referral_title'), fn: () => { setShowReferral(true); setAvatarMenu(false) } },
                  ]),
                  { icon: '📣', label: t('menu_news') || 'Nouveautés', notif: hasReleaseNotif, fn: () => { clearReleaseNotif(); setDocsPage('release-notes'); setShowDocs(true); setAvatarMenu(false); window.history.pushState({}, '', '/release-notes') } },
                  { icon: '🎮', label: t('discord_menu') || 'Discord', color: '#5865F2', fn: () => { openDiscord(); setAvatarMenu(false) } },
                  ...(auth.profile?.role === 'admin' ? [{ icon: '🔧', label: t('menu_admin') || 'Administration', fn: () => { setShowAdmin(true); setAvatarMenu(false); window.history.pushState({}, '', '/admin') } }] : []),
                  null,
                  // Invité (démo) : pas de déconnexion → inscription (conversion, garde les geocoins).
                  auth.isDemo
                    ? { icon: '✨', label: t('demo_signup_now'), color: '#a29bfe', fn: () => { setShowAuth(true); setAvatarMenu(false); } }
                    : { icon: '↩', label: t('btn_logout'), color: '#f85149', fn: () => { auth.signOut(); setAvatarMenu(false); setHistory([]); setPendingQuiz(null); setActiveQuiz(null); } },
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
      {/* Visiteur (non connecté) : profil démo synthétique → l'app s'affiche en mode
          démo. LandingSection ne sert plus que de splash pendant auth.loading. */}
      {!auth.profile && import.meta.env.VITE_API_URL ? (
        <LandingSection onOpenAuth={() => setShowAuth(true)} />
      ) : (
        <div style={{ flex: 1, display: isWide ? 'flex' : 'block', alignItems: 'flex-start' }}>

          {/* LEFT SIDEBAR (desktop) / HOME TAB (mobile) */}
          {/* ── LEFT SIDEBAR content ── */}
          {(isWide || activeTab === 'home') && auth.profile && (
            <aside style={{ width: isWide ? 288 : '100%', flexShrink: 0, padding: '14px 16px', borderRight: isWide ? `1px solid ${theme.border}` : 'none', display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeLeft .35s ease-out both', ...(isWide ? { position: 'sticky', top: 53, maxHeight: 'calc(100vh - 53px)', overflowY: 'auto' } : {}) }}>

              {/* Countdown hero (mobile only — en haut) */}
              {!isWide && !anyActiveQuiz && auth.profile?.status !== 'banni' && (
                <div data-tour="countdown">
                  {demoComplete
                    ? <DemoComplete onSignup={() => setShowAuth(true)} t={t} />
                    : renderQuizBar()}
                </div>
              )}

              {/* User profile mini card — données disponibles progressivement */}
              {(() => {
                const scoreReady = gs.collectionLoaded && gs.cardPool.length > 0
                const rank   = scoreReady ? getRank(userScore, gs.limits.playerRanks) : null
                const { c1, c2 } = rank ? rankCC(rank) : { c1: '#6b7280', c2: '#9ca3af' }
                const sortedRanks = scoreReady ? [...(gs.limits.playerRanks || DEFAULT_RANKS)].sort((a, b) => a.min - b.min) : []
                const nextRank = scoreReady ? sortedRanks.find(r => r.min > userScore) : null
                const pct      = scoreReady ? (nextRank ? Math.min(100, Math.round((userScore / nextRank.min) * 100)) : 100) : 0
                const nonAchievementIds = new Set(gs.cardPool.filter(c => c.rarity !== 'achievement' && c.type !== 'Achievement').map(c => String(c.id)))
                const shinyCards  = gs.collectionLoaded ? Object.keys(gs.shinyCollection || {}).filter(k => (gs.shinyCollection[k] || 0) > 0 && nonAchievementIds.has(k)).length : null
                // Total de geocoins possédés (cartes achievement incluses) —
                // cohérent avec le card_count affiché dans le classement.
                const uniqueCards = gs.collectionLoaded
                  ? countOwnedUnique(gs.collection)
                  : null
                const dk = THEMES.dark
                const shimCell = { height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#ffffff08,#ffffff18,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', margin: '2px auto', width: '55%' }
                return (
                  <div data-tour="profile" style={{ background: dk.bgSurface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c1}66`, position: 'relative', overflow: 'hidden', flexShrink: 0, animation: 'fadeUp .4s .05s ease-out both', transition: 'border-color .4s' }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${c1}14`, pointerEvents: 'none', transition: 'background .4s' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 0 14px ${c1}44`, border: `2px solid ${c1}44`, transition: 'background .4s, box-shadow .4s' }}>
                        {auth.profile.pseudo?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: dk.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <PseudoDisplay pseudo={auth.profile.pseudo} score={userScore} ranks={gs.limits.playerRanks} style={{ color: dk.textPrimary }}/>
                        </div>
                        <div style={{ marginTop: 2, height: 16, display: 'flex', alignItems: 'center' }}>
                          {rank
                            ? <span style={{ fontSize: 11, fontWeight: 800, color: c1 }}>{rank.label}</span>
                            : <div style={{ height: 10, width: '38%', borderRadius: 4, background: 'linear-gradient(90deg,#ffffff08,#ffffff18,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                      <div style={{ background: dk.overlayMd, borderRadius: 8, padding: '6px 2px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12 }}>🃏</div>
                        {uniqueCards === null
                          ? <div style={shimCell} />
                          : (
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontWeight: 900, fontSize: 12, color: dk.textPrimary, lineHeight: 1.2 }}>{uniqueCards}</span>
                              {shinyCards > 0 && <span style={{ fontWeight: 800, fontSize: 9, color: '#f9ca24', lineHeight: 1.2 }}>✨{shinyCards}</span>}
                            </div>
                          )
                        }
                        <div style={{ fontSize: 7, color: dk.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>{t('stat_geocoins')}</div>
                      </div>
                      {[
                        { icon: '💰', value: gs.gold,        label: t('stat_gold') },
                        { icon: '🔨', value: gs.forgePoints, label: t('stat_forge') },
                      ].map(({ icon, value, label }) => (
                        <div key={label} style={{ background: dk.overlayMd, borderRadius: 8, padding: '6px 2px', textAlign: 'center' }}>
                          <div style={{ fontSize: 12 }}>{icon}</div>
                          {value === null
                            ? <div style={shimCell} />
                            : <div style={{ fontWeight: 900, fontSize: 12, color: dk.textPrimary, lineHeight: 1.2 }}>{value}</div>
                          }
                          <div style={{ fontSize: 7, color: dk.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {scoreReady ? (
                      nextRank ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: dk.textSecondary }}>
                            <span>{t('rank_next')} <span style={{ background: nextRank.color, color: '#fff', fontWeight: 800, padding: '1px 6px', borderRadius: 4, fontSize: 9, textShadow: '0 1px 2px #0004' }}>{nextRank.label}</span></span>
                            <span onClick={() => setShowScoreDetail(true)} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{userScore}/{nextRank.min}</span>
                          </div>
                          <div style={{ background: dk.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }}/>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 800, color: c1, textAlign: 'center' }}>{t('rank_max')}</div>
                      )
                    ) : (
                      <div style={{ height: 8, borderRadius: 50, background: 'linear-gradient(90deg,#ffffff05,#ffffff12,#ffffff05)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s .1s infinite' }} />
                    )}
                  </div>
                )
              })()}

              {/* Daily quests */}
              <div data-tour="quests">
                <DailyQuests quests={gs.quests} />
              </div>

              {/* Last 8 geocoins — 4×2 (feed propre au mode courant). En Entraînement,
                  on n'affiche que les manches AVEC au moins un gagnant. */}
              {(beginnerActive ? beginner.history : history).filter(h => !h.skipped && (!beginnerActive || (h.winners_count || 0) > 0)).length > 0 && (
                <div style={{ animation: 'fadeUp .4s .2s ease-out both' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: theme.textMuted, marginBottom: 4 }}>{t('last_cards')}</div>
                  <div style={{ background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px' }}>
                  <div style={isWide
                    ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }
                    : { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, justifyItems: 'center' }}>
                    {(beginnerActive ? beginner.history : history).filter(h => !h.skipped && (!beginnerActive || (h.winners_count || 0) > 0)).slice(0, 8).map((h, i) => {
                      const { c1, c2 } = cardCC(h.card?.rarity || 'commun');
                      // « Gagné par moi » = drapeau won OU pseudo == le mien : évite de se voir
                      // tantôt en ✓, tantôt sous son pseudo (selon la source de l'entrée).
                      // En débutant : plusieurs gagnants → on coche si je suis dans la liste.
                      const hasGlory = !beginnerActive && (h.glory_winners || []).length > 0;
                      // Round MULTI-prix (≥2 gagnants réels) → tuile unique « N🏆 » + popup des gagnants,
                      // comme la gloire (au lieu de dupliquer le même geocoin par gagnant).
                      const multiWinners = (!beginnerActive && Array.isArray(h.winners) && h.winners.length > 1) ? h.winners : null;
                      // Geocoin joué pour la gloire sans gagnant (winner null) → ne pas ajouter un gagnant fantôme.
                      const allWinners = hasGlory ? (h.winner ? [...h.glory_winners, h.winner] : [...h.glory_winners]) : null;
                      const mine = beginnerActive
                        ? (Array.isArray(h.winners) && h.winners.includes(auth.profile?.pseudo))
                        : (h.won || (!!h.winner && h.winner === auth.profile?.pseudo) || (Array.isArray(h.winners) && h.winners.includes(auth.profile?.pseudo)));
                      return (
                        <div key={i} title={h.card?.name} onClick={() => {
                          if (!h.card) return;
                          if (beginnerActive) { setBeginnerWinnersPopup({ card: gs.cardPool.find(c => c.id === h.card.id) || h.card, winners: h.winners || [] }); return; }
                          // Round multi-prix et/ou gloire : liste unifiée [gloire…, gagnants réels…].
                          // gloryCount = nb de « pour la gloire » → la modale sépare les deux sections
                          // (sinon, en multi-prix AVEC gloire, les joueurs-gloire n'apparaissaient pas).
                          if (multiWinners || hasGlory) {
                            const gloryArr = hasGlory ? h.glory_winners : [];
                            const realArr = multiWinners ? multiWinners : (h.winner ? [h.winner] : []);
                            setBeginnerWinnersPopup({ card: gs.cardPool.find(c => c.id === h.card.id) || h.card, winners: [...gloryArr, ...realArr], gloryCount: gloryArr.length });
                            return;
                          }
                          setSelectedCard(gs.cardPool.find(c => c.id === h.card.id) || h.card); setSelectedCardIsShiny(h.isShiny || false); setSelectedCardFromHistory(true);
                        }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', flexShrink: 0, minWidth: 0, maxWidth: isWide ? undefined : 44 }}>
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
                          <div style={{ fontSize: 8, fontWeight: 700, color: mine ? '#3fb950' : theme.textSecondary, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {beginnerActive
                              ? `${mine ? '✓ ' : ''}${h.winners_count || 0}🏆`
                              : mine
                                ? `✓${multiWinners ? ` (${multiWinners.length}🏆)` : hasGlory ? ` (${(h.glory_winners || []).length}🏆)` : ''}`
                                : multiWinners ? `${multiWinners.length}🏆` : hasGlory ? `${allWinners.length}🏆` : h.winner}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {onlineCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 700, color: theme.textSecondary }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 6px #3fb95099' }} />
                      {t('online_users').replace('{n}', onlineCount)}
                    </div>
                  )}
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* ── RIGHT PANEL : collection / market / forge / top ── */}
          {(isWide || !auth.profile || activeTab !== 'home') && (
            <main style={{ flex: 1, padding: isWide ? '14px 20px' : '12px 14px', minWidth: 0 }}>

              {/* New geocoin available — above type filter */}
              {auth.profile && !anyActiveQuiz && auth.profile?.status !== 'banni' && activeTab !== 'tresors' && (
                <div data-tour="countdown" style={{ marginBottom: 14 }}>
                  {demoComplete
                    ? <DemoComplete onSignup={() => setShowAuth(true)} t={t} />
                    : renderQuizBar()}
                </div>
              )}

              {/* ── Bandeau figé sous le header : onglets de types + barre de recherche.
                  Reste visible pendant le défilement des geocoins ; déborde des
                  gouttières du <main> (fond opaque) pour couvrir toute la largeur. */}
              {(!auth.profile || activeTab === 'collection') && (gs.cardPool.length > 0 || !currentTabLocked) && (
              <div style={{ position: 'sticky', top: headerH, zIndex: 150, background: theme.bgMain, margin: isWide ? '0 -20px' : '0 -14px', padding: isWide ? '2px 20px 0' : '2px 14px 0', boxShadow: '0 10px 14px -12px #000a' }}>
                {gs.cardPool.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                  {typeTabs.map(({ type: tp, total, owned, locked }) => {
                    const pct   = total > 0 ? Math.round(owned / total * 100) : 0
                    const full  = owned === total && total > 0
                    const active = filter === tp
                    return (
                      <button key={tp} onClick={() => setFilter(tp)} style={{ flexShrink: 0, background: active ? '#f9ca24' : theme.bgSurface, border: `1px solid ${active ? '#f9ca24' : theme.border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all .15s', textAlign: 'center', minWidth: 60, opacity: locked && !active ? 0.7 : 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: active ? '#1a2538' : full ? '#3fb950' : theme.textSecondary, whiteSpace: 'nowrap', marginBottom: 2 }}>{tp === 'Tous' ? t('filter_all') : typeLabel(tp, gs.limits.typeTranslations, lang)}{locked ? <span style={{ marginLeft: 3, fontSize: 9, opacity: .7 }}>🔒</span> : ''}</div>
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

                {/* Barre de contrôles : search + filtres + tri */}
                {!currentTabLocked && (
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 10, flexWrap: 'wrap' }}>
                    <input value={cardSearch} onChange={e => { setCardSearch(e.target.value); setSelectedCard(null); }} placeholder={t('collection_search')}
                      style={{ flex: 1, minWidth: 100, background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textPrimary, padding: '7px 11px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none' }}/>

                    {/* ✨ Shiny — en démo : présentation de la feature au lieu du filtre */}
                    <button onClick={() => { if (auth.isDemo) { setDemoInfo('shiny'); return; } setShowShiny(v => !v); setGridAnimKey(k => k+1); }}
                      style={{ flexShrink: 0, background: showShiny ? '#f9ca2422' : theme.bgInput, border: `1px solid ${showShiny ? '#f9ca24' : theme.border}`, color: showShiny ? '#f9ca24' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {t('filter_shiny')}
                    </button>

                    {/* Tri — en démo : bouton « Raretés » (présentation) au lieu du menu de tri */}
                    {auth.isDemo ? (
                      <button onClick={() => setDemoInfo('rarity')}
                        style={{ flexShrink: 0, background: theme.bgInput, border: `1px solid ${theme.border}`, color: theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {t('demo_rarity_btn')}
                      </button>
                    ) : (
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
                              <button key={val} onClick={() => { setSortBy(val); setGridAnimKey(k => k+1); setSortMenuOpen(false); }}
                                style={{ display: 'block', width: '100%', background: sortBy === val ? '#f9ca2418' : 'none', border: 'none', borderBottom: `1px solid ${theme.border}`, color: sortBy === val ? theme.gold : theme.textPrimary, padding: '9px 14px', fontFamily: "'Nunito',sans-serif", fontWeight: sortBy === val ? 900 : 600, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                                {sortBy === val ? '✓ ' : ''}{lbl}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    )}

                    {/* Manquants — masqué en démo (collection = uniquement les geocoins gagnés)
                        et en vue d'ensemble (les manquants y sont toujours affichés) */}
                    {!auth.isDemo && !collViewAll && <button onClick={() => setShowMissing(v => !v)}
                      style={{ flexShrink: 0, background: showMissing ? '#6c5ce7' : theme.bgInput, border: `1px solid ${showMissing ? '#6c5ce7' : theme.border}`, color: showMissing ? '#fff' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {showMissing ? t('filter_owned') : t('filter_missing')}
                    </button>}

                    {/* Vue d'ensemble « tout en un » : toute la collection sur une page, manquants inclus */}
                    {!auth.isDemo && <button onClick={() => setCollViewAll(v => !v)}
                      style={{ flexShrink: 0, background: collViewAll ? '#f9ca24' : theme.bgInput, border: `1px solid ${collViewAll ? '#f9ca24' : theme.border}`, color: collViewAll ? '#1a2538' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      ⊞ {t('coll_view_all')}
                    </button>}
                  </div>
                )}
              </div>
              )}

              {/* Collection content (grille) — en démo, les types non jouables invitent à se connecter */}
              {(!auth.profile || activeTab === 'collection') && (currentTabLocked ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 46 }}>✨</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: theme.textPrimary, maxWidth: 300, lineHeight: 1.4 }}>{t('demo_locked_sub')}</div>
                  <button onClick={() => setShowAuth(true)} style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '13px 26px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, boxShadow: '0 8px 24px #6c5ce755' }}>{t('demo_locked_cta')}</button>
                </div>
              ) : (
                <>
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
                  ) : collViewAll ? (
                    <CollectionOverview
                      items={displayCards} theme={theme} isMobile={isMobile} lang={lang}
                      onSelect={(card, isShiny, isAchievement) => { setSelectedCard({ ...card, desc: (!isShiny && gs.collectionDescriptions?.[card.id]) || card.desc || '', progressInfo: isAchievement ? gs.achievementProgress?.[card.id] : null }); setSelectedCardIsShiny(isShiny); setSelectedCardFromHistory(false); }}
                    />
                  ) : (
                    <CollectionScroll
                      items={displayCards} batch={COLL_PAGE_SIZE} theme={theme} isMobile={isMobile}
                      gridKey={gridAnimKey} topLabel={t('coll_back_top')}
                      resetKey={`${filter}|${sortBy}|${cardSearch}|${showShiny}|${showMissing}|${gridAnimKey}`}
                      renderItem={({ card, count, cnt, missing, isShiny }, idx) => {
                        const c = count || cnt || 0;
                        const isAchievement = card.type?.toLowerCase().startsWith('achievement')
                        const isEvolutive = isAchievement && !!gs.achievementProgress?.[card.id]?.tiers
                        // Cascade par lot : délai selon la position DANS le lot (stable pour un
                        // idx donné) → les cartes déjà montées ne rejouent pas leur animation
                        // quand le lot suivant apparaît en dessous.
                        const anim = gridAnimKey > 0
                          ? `cardSort .4s ${(idx % COLL_PAGE_SIZE) * 0.03}s cubic-bezier(.34,1.56,.64,1) both`
                          : `collBatchIn .45s ${(idx % COLL_PAGE_SIZE) * 0.02}s cubic-bezier(.34,1.56,.64,1) both`
                        return (
                          <div key={`${card.id}${isShiny ? '_shiny' : ''}`} style={{ position: 'relative', animation: anim }} {...(idx === 0 ? { 'data-tour': 'collection' } : {})}>
                            {isEvolutive && <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 7, background: '#f9ca24cc', color: '#1e3045', fontSize: 8, fontWeight: 900, borderRadius: 4, padding: '2px 5px', letterSpacing: .3, pointerEvents: 'none' }}>ÉVOLUTIF</div>}
                            <Card card={card} count={missing ? 0 : c} dimmed={missing} isShiny={!!isShiny} onClick={(missing && !isAchievement) ? undefined : () => { setSelectedCard({ ...card, desc: (!isShiny && gs.collectionDescriptions?.[card.id]) || card.desc || '', progressInfo: isAchievement ? gs.achievementProgress?.[card.id] : null }); setSelectedCardIsShiny(!!isShiny); setSelectedCardFromHistory(false); }} />
                          </div>
                        );
                      }}
                    />
                  )}
                </>
              ))}

              {/* Market inline */}
              {auth.profile && activeTab === 'market' && (
                <MarketModal inline loading={gs.loadingData || !gs.marketLoaded}
                  myCollection={gs.collection} market={gs.market} gold={gs.gold} cardPool={gs.cardPool}
                  myListings={gs.myListings} transactions={gs.transactions}
                  onClose={() => setActiveTab('collection')}
                  onBuy={handleBuy} onListCard={handleListCard} onCancelListing={handleCancelListing} onCancelAllListings={handleCancelAllListings}
                  onBuyOffseason={handleBuyOffseason} forgePoints={gs.forgePoints}
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
                  forgeCostByRarity={gs.limits.forgeCostByRarity ?? {}}
                  meltPointsByRarity={gs.limits.meltPointsByRarity ?? {}}
                  meltPointsByRarityShiny={gs.limits.meltPointsByRarityShiny ?? {}}
                  achievementProgress={gs.achievementProgress}
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
                  onMelted={(data) => {
                    if (data?.forge_points_remaining !== undefined) {
                      gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
                    }
                    if (data?.card) {
                      gs.setCollection(prev => ({ ...prev, [data.card.id]: Math.max(0, (prev[data.card.id] || 0) - 1) }))
                    }
                  }}
                  onMeltedShiny={(data) => {
                    if (data?.forge_points_remaining !== undefined) {
                      gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
                    }
                    if (data?.card) {
                      gs.setShinyCollection(prev => ({ ...prev, [data.card.id]: Math.max(0, (prev[data.card.id] || 0) - 1) }))
                    }
                  }}
                  onMeltedAll={(data) => {
                    if (data?.forge_points_remaining !== undefined) {
                      gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
                    }
                    if (data?.melted) {
                      gs.setCollection(prev => {
                        const next = { ...prev }
                        for (const m of data.melted) next[m.card_id] = 1
                        return next
                      })
                    }
                  }}
                  onMeltedAllShiny={(data) => {
                    if (data?.forge_points_remaining !== undefined) {
                      gs.addForgePoints(data.forge_points_remaining - gs.forgePoints)
                    }
                    if (data?.melted) {
                      gs.setShinyCollection(prev => {
                        const next = { ...prev }
                        for (const m of data.melted) next[m.card_id] = 1
                        return next
                      })
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
                  shopPacksConfig={gs.limits?.shopPacks ?? null}
                  shopTestMode={!!gs.limits?.shopTestMode}
                  isAdmin={auth.profile?.role === 'admin'}
                  packsLoading={gs.loadingData}
                  dailyOfferGold={gs.limits?.dailyOfferGold ?? 5}
                  onOpenCgv={null}
                  holds={holds}
                  holdSlots={holdSlots}
                  holdRentActive={holdRentActive}
                  holdSlotPrices={gs.limits?.holdSlotPrices ?? [150, 400]}
                  holdRentPrice={gs.limits?.holdRentPrice ?? 80}
                  gold={gs.gold}
                  onClaimHold={handleClaimHold}
                  onBuyHoldSlot={handleBuyHoldSlot}
                  onRentHoldSlot={handleRentHoldSlot}
                />
              )}

              {/* Leaderboard inline */}
              {auth.profile && activeTab === 'top' && (
                <LeaderboardModal inline
                  myCollection={gs.collection} myShinyCollection={gs.shinyCollection}
                  myPseudo={auth.profile?.pseudo} myId={auth.profile?.id}
                  myScore={userScore} myGold={gs.gold} myForgePoints={gs.forgePoints}
                  cardPool={gs.cardPool} ranks={gs.limits.playerRanks}
                  scoreRules={gs.limits.scoreRules} shinyScoreRules={gs.limits.shinyScoreRules}
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
            { id: 'tresors',     icon: '💎', label: t('nav_tresors'), badge: dailyOffer && !dailyOffer.claimed ? 1 : 0, disabled: auth.isDemo || gs.limits.featureTresor === false, tour: 'nav-tresors' },
            { id: 'collection',  icon: '🃏', label: t('nav_collection'), tour: 'nav-collection' },
            { id: 'market',      icon: '🏪', label: t('nav_market'), badge: gs.unreadSales, tour: 'nav-market', disabled: auth.isDemo || gs.limits.featureMarket === false},
            ...(gs.cardPool.some(c => c.forgeable) || gs.limits.shinyForgeOpen !== false ? [{ id: 'forge', icon: '🔨', label: t('nav_forge'), tour: 'nav-forge', disabled: auth.isDemo || gs.limits.featureForge === false }] : []),
            { id: 'top',         icon: '🏆', label: t('nav_top'), tour: 'nav-top', disabled: auth.isDemo || gs.limits.featureLeaderboard === false },
          ].map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} onClick={() => item.disabled ? (auth.isDemo && setDemoInfo(item.id)) : setActiveTab(item.id)}
                data-tour={item.tour}
                style={{ flex: 1, background: 'none', border: 'none', color: item.disabled ? theme.textMuted : active ? '#f9ca24' : theme.textSecondary, padding: '9px 4px 11px', cursor: (item.disabled && !auth.isDemo) ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative', fontFamily: "'Nunito',sans-serif", transition: 'color .15s', opacity: item.disabled ? 0.45 : 1 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: .3 }}>{item.label}</span>
                {item.disabled && <span style={{ fontSize: 7, fontWeight: 800, color: '#e74c3c', letterSpacing: .2, whiteSpace: 'nowrap' }}>{auth.isDemo ? t('tab_signin') : t('coming_soon')}</span>}
                {!item.disabled && item.badge > 0 && <span style={{ position: 'absolute', top: 7, left: '55%', background: '#e74c3c', color: '#fff', width: 15, height: 15, borderRadius: '50%', fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.badgeBorder}` }}>{item.badge > 9 ? '9+' : item.badge}</span>}
                {!item.disabled && active && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#f9ca24', borderRadius: '0 0 3px 3px' }} />}
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
      {toast && (
        <div style={{ position: 'fixed',bottom: 28,right: 28,zIndex: 3000,background: toast.type === 'error' ? '#d63031' : '#00b894',color: '#fff',padding: '11px 18px',borderRadius: 12,fontWeight: 800,fontSize: 13,boxShadow: '0 8px 32px #0006',animation: 'toastIn .4s cubic-bezier(.34,1.56,.64,1) both' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Achievement toast queue ── */}
      {gs.pendingAch.length > 0 && (
        <AchievementToast achievement={gs.pendingAch[0]} cardPool={gs.cardPool} onClose={() => gs.setPendingAch(prev => prev.slice(1))} />
      )}

      {/* ── Achievement upgrade popup queue (montées de palier) ── */}
      {gs.pendingUpgrade.length > 0 && (
        <AchievementUpgradePopup upgrade={gs.pendingUpgrade[0]} cardPool={gs.cardPool} onClose={() => gs.setPendingUpgrade(prev => prev.slice(1))} />
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

      {/* ── HoldModal — apparaît après un quiz hors-limite avec une carte éligible ── */}
      {holdOffer && (
        <HoldModal
          holdCard={holdOffer}
          holds={holds}
          holdSlots={holdSlots}
          holdRentActive={holdRentActive}
          rentPrice={gs.limits?.holdRentPrice ?? 80}
          replacePrice={gs.limits?.holdReplacePrice ?? 50}
          gold={gs.gold}
          owned={holdOffer.is_shiny ? (gs.shinyCollection?.[holdOffer.id] || 0) > 0 : (gs.collection?.[holdOffer.id] || 0) > 0}
          forgeCapped={computeCardLimitStatus(auth.profile, gs.limits).forgeCapped}
          onClose={() => setHoldOffer(null)}
          onStoreError={(err) => {
            // Le serveur a refusé (dépôt plein / or insuffisant) : rien n'a été détruit.
            // On resynchronise l'état du dépôt pour ré-afficher les bons choix.
            refreshHold()
            showToast(err || t('demo_error'), 'error')
          }}
          onStored={(card, data = {}) => {
            const forgePoints = data.forge_points_earned || 0
            setHoldOffer(null)
            if (typeof data.gold === 'number') gs.setGold(data.gold)
            if (forgePoints > 0) gs.addForgePoints(forgePoints)
            refreshHold()
            if (data.hold_full) {
              // Dépôt plein sans choix : le geocoin n'a PAS été stocké, on reçoit 1 PF.
              showToast(forgePoints > 0 ? t('toast_quiz_forge_taken').replace('{n}', forgePoints) : t('toast_forge_limit'),
                forgePoints > 0 ? 'success' : 'error')
              return
            }
            showToast(forgePoints > 0
              ? `${t('toast_hold_stored').replace('{card}', card.name)} ${t('toast_hold_replaced_forge').replace('{n}', forgePoints)}`
              : t('toast_hold_stored').replace('{card}', card.name))
          }}
          onTakeForgePoint={async () => {
            const { data } = await apiTakeForgeInsteadOfHold()
            const fp = data?.forge_points_earned || 0
            if (fp > 0) gs.addForgePoints(fp)
            setHoldOffer(null)
            showToast(fp > 0 ? t('toast_quiz_forge_taken').replace('{n}', fp) : t('toast_forge_limit'), fp > 0 ? 'success' : 'error')
          }}
        />
      )}

      {/* ── Modals ── */}
      {/* Popup « Pour la gloire » — hôte permanent : découplée de son bouton
          déclencheur pour survivre au démontage des bannières éphémères. */}
      <GloryInfoModalHost />
      {/* Popup « Limites atteintes » — même hôte permanent, découplé du bouton ⓘ du
          bandeau de quiz pour survivre au démontage du QuizModal entre les manches. */}
      <LimitInfoModalHost />
      {/* QuizNotif popup disabled */}
      {/* Modale Mode Débutant (plusieurs gagnants, communs, sans forge) */}
      {beginnerActive && beginner.activeQuiz && <QuizModal beginner roundDuration={beginner.cycleSec} quiz={beginner.activeQuiz} isShiny={false} limitStatus={computeCardLimitStatus(auth.profile, gs.limits)} upsell={limitUpsell} onAnswer={wrappedBeginnerAnswer} onExpire={beginner.handleClose} onClose={beginner.handleClose} />}

      {/* Modale de règles du jeu (PVP vs Débutant) */}
      {showRules && <GameRulesModal onClose={() => setShowRules(false)} />}

      {/* Liste des gagnants d'une manche Entraînement (clic sur le feed) */}
      {beginnerWinnersPopup && <BeginnerWinnersModal card={beginnerWinnersPopup.card} winners={beginnerWinnersPopup.winners} gloryCount={beginnerWinnersPopup.gloryCount || 0} onClose={() => setBeginnerWinnersPopup(null)} />}

      {!beginnerActive && activeQuiz  && <QuizModal quiz={activeQuiz} isShiny={activeQuiz?.is_shiny ?? quizIsShiny} graceDeadline={activeQuiz?.graceDeadline ?? null} limitStatus={auth.isDemo ? null : computeCardLimitStatus(auth.profile, gs.limits)} upsell={limitUpsell} streakLeader={auth.isDemo ? null : streakLeader} myId={auth.profile?.id} alreadyOwned={!!activeQuiz?.card?.id && ((activeQuiz?.is_shiny ?? quizIsShiny) ? (gs.shinyCollection?.[activeQuiz.card.id] || 0) > 0 : (gs.collection?.[activeQuiz.card.id] || 0) > 0)} holdState={{ holds, holdSlots, holdRentActive, rentPrice: gs.limits?.holdRentPrice ?? 80, replacePrice: gs.limits?.holdReplacePrice ?? 50, gold: gs.gold }} onAnswer={wrappedHandleQuizAnswer} onExpire={auth.isDemo ? demoAdvance : handleQuizExpire} onClose={auth.isDemo ? demoAdvance : handleCloseActiveQuiz}
        onNeedQuestion={async () => {
          // Délai cadeau écoulé : le serveur autorise enfin la question au leader.
          const { data } = await apiGetCurrentQuiz().catch(() => ({ data: null }))
          if (!data?.quiz || data.quiz.question == null) return null
          const lang = getLang()
          const tr = data.quiz.translations?.[lang]
          const wc = data.quiz.answer_word_count || 1
          return {
            q: tr?.question || data.quiz.question,
            h: data.quiz.hint,
            answer_length: data.quiz.answer_length,
            a: tr?.answer ? Array((tr.answer.trim().split(/\s+/).length)||1).fill('x').join(' ') : Array(wc).fill('x').join(' '),
          }
        }} />}

      {showDocs && <DocsLayout initialPage={docsPage} isAdmin={auth.profile?.role === 'admin'} onClose={() => { setShowDocs(false); window.history.pushState({}, '', '/') }} />}

      {seasonPopup && !['pseudo', 'gift', 'card'].includes(onboardingStep) && (
        <SeasonPopup
          season={seasonPopup.season}
          cards={seasonPopup.cards}
          onClose={() => {
            setSeasonPopup(null)
            apiMarkSeasonSeen().catch(() => {})
            if (onboardingStep === 'season') setOnboardingStep('tour')
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
              setOnboardingStep(seasonPopup ? 'season' : 'tour')
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
          typeTranslations={gs.limits.typeTranslations}
          count={selectedCardFromHistory ? 0 : selectedCardIsShiny ? (gs.shinyCollection?.[selectedCard.id] || 0) : (gs.collection[selectedCard.id] || 0)}
          owned={selectedCardIsShiny ? (gs.shinyCollection?.[selectedCard.id] || 0) > 0 : (gs.collection[selectedCard.id] || 0) > 0}
          isShiny={selectedCardIsShiny}
          onClose={() => { setSelectedCard(null); setSelectedCardIsShiny(false); setSelectedCardFromHistory(false); }}
          onSell={() => { setMarketSellCard(selectedCard); setSelectedCard(null); setSelectedCardIsShiny(false); setSelectedCardFromHistory(false); setMarketTab('vendre'); setActiveTab('market'); }}
        />
      )}
      {showAuth        && <AuthModal auth={auth} isDemo={auth.isDemo} onClose={() => setShowAuth(false)} onSuccess={handleLoginSuccess} />}

      {/* Démo : présentation des features (Shiny, Raretés, Trésors, Marché, Forge, Classement) */}
      {demoInfo && (() => {
        const FEAT = {
          tresors: { icon: '💎', grad: '#c87f0a,#f0932b', title: t('nav_tresors'), desc: t('demo_feat_tresors_desc'), points: [['🎁', t('demo_feat_tresors_p1')]] },
          market:  { icon: '🏪', grad: '#0984e3,#74b9ff', title: t('nav_market'),  desc: t('demo_feat_market_desc'),  points: [['💰', t('demo_feat_market_p1')], ['🔎', t('demo_feat_market_p2')], ['📈', t('demo_feat_market_p3')]] },
          forge:   { icon: '🔨', grad: '#d63031,#ff7675', title: t('nav_forge'),   desc: t('demo_feat_forge_desc'),   points: [['🔨', t('demo_feat_forge_p1')], ['✨', t('demo_feat_forge_p2')], ['♻️', t('demo_feat_forge_p3')]] },
          top:     { icon: '🏆', grad: '#6c5ce7,#a29bfe', title: t('nav_top'),     desc: t('demo_feat_top_desc'),     points: [['🥇', t('demo_feat_top_p1')], ['⚡', t('demo_feat_top_p2')], ['🔥', t('demo_feat_top_p3')]] },
        };
        const feat = FEAT[demoInfo];
        const shinyCard = gs.cardPool?.[0] || nextCard;
        const loginBtn = <button onClick={() => { setDemoInfo(null); setShowAuth(true); }} style={{ width: '100%', background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 900, boxShadow: '0 8px 24px #6c5ce755' }}>{t('btn_login')}</button>;
        const Points = ({ items }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22 }}>
            {items.map(([ic, tx], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontSize: 19, flexShrink: 0 }}>{ic}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.textSecondary, lineHeight: 1.4 }}>{tx}</span>
              </div>
            ))}
          </div>
        );
        return (
        <div onClick={() => setDemoInfo(null)} style={{ position: 'fixed', inset: 0, background: '#000a', backdropFilter: 'blur(4px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn .2s ease', fontFamily: "'Nunito',sans-serif" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 380, background: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px #000c', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'popIn .25s cubic-bezier(.34,1.56,.64,1) both' }}>
            <button onClick={() => setDemoInfo(null)} style={{ position: 'absolute', top: 14, right: 16, zIndex: 2, background: '#0003', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 15, fontWeight: 900, lineHeight: 1 }}>×</button>

            {demoInfo === 'shiny' ? (
              <>
                <div style={{ padding: '28px 20px 22px', textAlign: 'center', background: 'radial-gradient(circle at 50% 35%, #f9ca2433, transparent 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  {shinyCard ? <Card card={shinyCard} count={1} isShiny /> : <div style={{ fontSize: 56 }}>✨</div>}
                  <div style={{ fontSize: 21, fontWeight: 900, color: theme.textPrimary }}>{t('demo_shiny_title')}</div>
                </div>
                <div style={{ padding: '4px 20px 22px', overflowY: 'auto' }}>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: theme.textPrimary, fontWeight: 600, margin: '0 0 16px' }}>{t('demo_shiny_desc')}</p>
                  <Points items={[['🌟', t('demo_shiny_p1')], ['💎', t('demo_shiny_p2')], ['🏆', t('demo_shiny_p3')]]} />
                  {loginBtn}
                </div>
              </>
            ) : demoInfo === 'rarity' ? (
              <>
                <div style={{ padding: '26px 20px 16px', textAlign: 'center', borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: theme.textPrimary }}>{t('demo_rarity_title')}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.textSecondary, marginTop: 5 }}>{t('demo_rarity_sub')}</div>
                </div>
                <div style={{ padding: '16px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {['légendaire', 'épique', 'rare', 'commun'].map(r => {
                      const rc = RARITY_CONFIG[r];
                      const rate = (gs.limits?.quizRarityRates || DEFAULT_RARITY_RATES)?.[r];
                      return (
                        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, background: theme.bgElevated, borderLeft: `4px solid ${rc.color}` }}>
                          <div style={{ fontSize: 13, color: rc.color, letterSpacing: 1, flexShrink: 0 }}>{'★'.repeat(rc.stars)}{'☆'.repeat(4 - rc.stars)}</div>
                          <div style={{ flex: 1, fontSize: 14, fontWeight: 900, color: rc.color }}>{rarityLabel(r, t)}</div>
                          {rate != null && <div style={{ fontSize: 12.5, fontWeight: 900, color: rc.color, background: rc.bg, borderRadius: 50, padding: '3px 11px', flexShrink: 0 }}>{rate}%</div>}
                        </div>
                      );
                    })}
                  </div>
                  {loginBtn}
                </div>
              </>
            ) : feat ? (
              <>
                <div style={{ padding: '32px 20px 22px', textAlign: 'center', background: `linear-gradient(135deg,${feat.grad})` }}>
                  <div style={{ fontSize: 52, filter: 'drop-shadow(0 3px 10px #0005)' }}>{feat.icon}</div>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#fff', marginTop: 4, textShadow: '0 2px 8px #0004' }}>{feat.title}</div>
                </div>
                <div style={{ padding: '18px 20px 22px', overflowY: 'auto' }}>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: theme.textPrimary, fontWeight: 600, margin: '0 0 16px' }}>{feat.desc}</p>
                  <Points items={feat.points} />
                  {loginBtn}
                </div>
              </>
            ) : null}
          </div>
        </div>
        );
      })()}
      {showChoosePseudo && <AuthModal auth={auth} initialMode="choose_pseudo"
        onClose={() => {
          // Fermée sans choisir : ne plus reproposer sur cet appareil (sinon
          // l'invite réapparaît à chaque connexion pour un pseudo OAuth hérité).
          try { if (auth.profile?.id) localStorage.setItem(`geocoins_pseudo_prompt_done_${auth.profile.id}`, '1') } catch { /* ignore */ }
          setShowChoosePseudo(false)
        }}
        onSuccess={() => setShowChoosePseudo(false)} />}
      {showScoreDetail && (() => {
        // Ce panneau est toujours rendu en thème sombre (il s'affiche mal en mode clair).
        const theme = THEMES.dark
        const W = gs.limits.scoreRules || { commun: 1, rare: 3, épique: 7, légendaire: 20 }
        const SW = gs.limits.shinyScoreRules || { commun: 2, rare: 6, épique: 14, légendaire: 40 }
        const rarities = ['légendaire', 'épique', 'rare', 'commun']
        const rows = rarities.map(r => {
          const normal = Object.entries(gs.collection).filter(([id, n]) => n > 0 && gs.cardPool.find(c => c.id === +id)?.rarity === r).length
          const shiny  = Object.entries(gs.shinyCollection || {}).filter(([id, n]) => n > 0 && gs.cardPool.find(c => c.id === +id)?.rarity === r).length
          return { r, normal, shiny, pts: W[r], shinyPts: SW[r] ?? W[r] * 2 }
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
                {rows.map(({ r, normal, shiny, pts, shinyPts }) => (
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
                        <span style={{ fontSize:13, color:theme.gold, fontWeight:900 }}>+{shiny * shinyPts} pts</span>
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
                        const n = parseInt((rank.color || '#888888').replace('#',''), 16)
                        const lum = (0.299*((n>>16)&255) + 0.587*((n>>8)&255) + 0.114*(n&255)) / 255
                        const displayColor = lum < 0.2
                          ? (() => { const r=(n>>16)&255,g=(n>>8)&255,b=n&255,f=0.65; return `rgb(${Math.round(r+(255-r)*f)},${Math.round(g+(255-g)*f)},${Math.round(b+(255-b)*f)})`})()
                          : rank.color
                        return (
                          <div key={rank.min} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:8, background: isCurrent ? `${rank.color}22` : theme.overlay, border: isCurrent ? `1px solid ${rank.color}66` : `1px solid ${theme.border}`, opacity: reached ? 1 : 0.5 }}>
                            <span style={{ flex:1, fontSize:12, fontWeight: isCurrent ? 900 : 700, color: displayColor }}>{getRankLabel(rank, lang)}</span>
                            <span style={{ fontSize:11, fontWeight:700, color: reached ? displayColor : theme.textMuted }}>{rank.min} pts</span>
                            {isCurrent && <span style={{ fontSize:9, fontWeight:900, color:displayColor, background:`${rank.color}22`, padding:'1px 6px', borderRadius:50 }}>{t('score_detail_current')}</span>}
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

      {showSettings && auth.profile && <SettingsModal auth={auth} collection={gs.collection} shinyCollection={gs.shinyCollection} cardPool={gs.cardPool} unlockedAch={gs.unlockedAch} ranks={gs.limits.playerRanks} limits={gs.limits} score={userScore} onBuyPocketBoost={auth.isDemo ? null : handleBuyPocketBoost} onBuyBagSlot={auth.isDemo ? null : handleBuyBagSlot} onStartTour={() => { setShowSettings(false); setShowTour(true) }} onClose={() => setShowSettings(false)} />}
      {showReferral && auth.profile && <ReferralModal onClose={() => setShowReferral(false)} />}
      {showShop && <ShopModal onClose={() => { setShowShop(false); setShopPackId(null); setRevealCards(null); setRevealGold(0); setRevealPayment('') }} cardPool={gs.cardPool} onPurchase={handlePurchase} shopPacksConfig={gs.limits?.shopPacks || {}} initialPackId={shopPackId} initialCards={revealCards} initialGold={revealGold} initialPaymentLabel={revealPayment} />}
      {/* CGV désactivée temporairement */}
      {showAdmin && auth.profile?.role === 'admin' && (
        <AdminPanel
          cardPool={gs.cardPool} cardTypes={gs.cardTypes} questions={questions} limits={gs.limits}
          maintenanceMode={gs.maintenance.on} maintenanceText={gs.maintenance.text}
          bannedIPs={gs.bannedIPs}
          onClose={() => { setShowAdmin(false); window.history.pushState({}, '', '/') }}
          onAddCard={gs.adminAddCard} onEditCard={gs.adminEditCard} onDeleteCard={gs.adminDeleteCard}
          onAddType={gs.adminAddType} onDeleteType={gs.adminDeleteType} onRenameType={gs.adminRenameType}
          onAddQuestion={async q => {
            if (q.id) { // déjà persisté (vient du batch import)
              setQuestions(prev => [...prev, q])
              return
            }
            const { data, error } = await apiAdminAddQuestion(q.q, q.a, q.translations, q.alt_answers, !!q.hidden)
            if (!error && data?.question) {
              const saved = data.question
              setQuestions(prev => [...prev, { id: saved.id, q: saved.question, a: saved.answer, hint: saved.hint || '', active: saved.active, hidden: !!saved.hidden, translations: saved.translations || {}, alt_answers: saved.alt_answers || [] }])
            }
          }}
          onReplaceQuestions={list => setQuestions(list)}
          onReleaseHiddenQuestions={async () => {
            const { data, error } = await apiReleaseHiddenQuestions()
            if (error) return { error }
            setQuestions(prev => prev.map(x => x.hidden ? { ...x, hidden: false } : x))
            return { released: data?.released || 0 }
          }}
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
                apiSetConfig('quiz_interval_tiers', limEdit.quizIntervalTiers ?? [{ players: 1, seconds: 300 }, { players: 2, seconds: 90 }, { players: 3, seconds: 60 }, { players: 4, seconds: 30 }]),
                apiSetConfig('quiz_streak_handicap', limEdit.quizStreakHandicap ?? { enabled: true, threshold: 3, step_seconds: 1.5, max_seconds: 8, min_players: 2 }),
                apiSetConfig('quiz_prize_tiers', limEdit.quizPrizeTiers ?? [{ players: 10, prizes: 2 }, { players: 20, prizes: 3 }, { players: 30, prizes: 4 }]),
                apiSetConfig('quiz_extra_prize_grace', limEdit.quizExtraPrizeGrace ?? 10),
                apiSetConfig('quiz_join_gold',       limEdit.quizJoinGold      ?? 1),
                apiSetConfig('quiz_win_gold',        limEdit.quizWinGold       ?? 5),
                apiSetConfig('quiz_daily_card_cap',    limEdit.quizDailyCardCap    ?? 20),
                apiSetConfig('quiz_hourly_card_cap',   limEdit.quizHourlyCardCap   ?? 0),
                apiSetConfig('quiz_daily_shiny_cap',   limEdit.quizDailyShinyCap   ?? 0),
                apiSetConfig('quiz_consolation_gold',  limEdit.quizConsolationGold  ?? 5),
                apiSetConfig('quiz_consolation_forge', limEdit.quizConsolationForge ?? 1),
                apiSetConfig('quiz_daily_forge_cap',   limEdit.quizDailyForgeCap    ?? 0),
                apiSetConfig('beginner_quiz_enabled',  limEdit.beginnerEnabled  !== false),
                apiSetConfig('beginner_quiz_duration', limEdit.beginnerDuration ?? 60),
                apiSetConfig('hold_slot_prices',       limEdit.holdSlotPrices   ?? [150, 400]),
                apiSetConfig('hold_rent_price',        limEdit.holdRentPrice    ?? 80),
                apiSetConfig('hold_replace_price',     limEdit.holdReplacePrice ?? 50),
                apiSetConfig('pocket_boost_price',     limEdit.pocketBoostPrice ?? 100),
                apiSetConfig('pocket_boost_cards',     limEdit.pocketBoostCards ?? 10),
                apiSetConfig('bag_slot_prices',        limEdit.bagSlotPrices    ?? [500, 1000, 2000, 4000, 6000]),
                apiSetConfig('forge_cost_by_rarity',   limEdit.forgeCostByRarity   ?? { commun:60,rare:180,épique:600,légendaire:1800 }),
                apiSetConfig('melt_points_by_rarity',  limEdit.meltPointsByRarity  ?? {}),
                apiSetConfig('melt_points_by_rarity_shiny', limEdit.meltPointsByRarityShiny ?? {}),
                apiSetConfig('market_price_caps',      limEdit.marketPriceCaps      ?? { commun:{floor:5,k:2},rare:{floor:25,k:2.5},épique:{floor:150,k:3},légendaire:{floor:1000,k:4} }),
                apiSetConfig('feature_tresor',       limEdit.featureTresor      ?? true),
                apiSetConfig('feature_market',       limEdit.featureMarket      ?? true),
                apiSetConfig('feature_forge',        limEdit.featureForge       ?? true),
                apiSetConfig('feature_leaderboard',  limEdit.featureLeaderboard ?? true),
                apiSetConfig('shiny_day',            limEdit.shinyDay           ?? null),
                apiSetConfig('quiz_rarity_rates',  limEdit.quizRarityRates   ?? DEFAULT_RARITY_RATES),
                ...(limEdit.cache_ttl_cards       != null ? [apiSetConfig('cache_ttl_cards',       limEdit.cache_ttl_cards)]       : []),
                ...(limEdit.cache_ttl_config      != null ? [apiSetConfig('cache_ttl_config',      limEdit.cache_ttl_config)]      : []),
                ...(limEdit.cache_ttl_leaderboard != null ? [apiSetConfig('cache_ttl_leaderboard', limEdit.cache_ttl_leaderboard)] : []),
                ...(limEdit.cache_ttl_market      != null ? [apiSetConfig('cache_ttl_market',      limEdit.cache_ttl_market)]      : []),
                ...(limEdit.cache_ttl_quiz_stats  != null ? [apiSetConfig('cache_ttl_quiz_stats',  limEdit.cache_ttl_quiz_stats)]  : []),
                // Ne sauvegarder player_ranks que si explicitement modifié (evite d'écraser les rangs custom avec DEFAULT_RANKS quand la config n'était pas encore chargée)
                ...(limEdit.playerRanks !== DEFAULT_RANKS ? [apiSetConfig('player_ranks', limEdit.playerRanks)] : []),
                apiSetConfig('market_sales_open',   limEdit.marketSalesOpen   ?? true),
                apiSetConfig('max_active_listings', limEdit.maxActiveListings ?? 10),
                apiSetConfig('bots_visible',        limEdit.botsVisible       ?? false),
                apiSetConfig('support_visible',     limEdit.supportVisible    ?? true),
                apiSetConfig('leaderboard_visible', limEdit.leaderboardVisible?? true),
                apiSetConfig('market_expire_days',  limEdit.marketExpireDays  ?? 30),
                ...(limEdit.typeTranslations != null ? [apiSetConfig('type_translations', limEdit.typeTranslations)] : []),
                ...(limEdit.registrationWhitelist != null ? [apiSetConfig('registration_whitelist', limEdit.registrationWhitelist)] : []),
                apiSetConfig('shiny_rate',        limEdit.shinyRate        ?? 0.1),
                apiSetConfig('force_shiny_count', Math.max(0, limEdit.forceShinyCount ?? 0)),
                apiSetConfig('shiny_forge_open',  limEdit.shinyForgeOpen   ?? true),
                apiSetConfig('score_rules',       limEdit.scoreRules       ?? { commun:1, rare:3, épique:7, légendaire:20 }),
                apiSetConfig('shiny_score_rules',  limEdit.shinyScoreRules  ?? { commun:2, rare:6, épique:14, légendaire:40 }),
                apiSetConfig('referral_required_count',    limEdit.referralRequiredCount   ?? 1),
                apiSetConfig('referral_min_geocoins',      limEdit.referralMinGeocoins     ?? 50),
                apiSetConfig('referral_max_join_geocoins', limEdit.referralMaxJoinGeocoins ?? 10),
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
