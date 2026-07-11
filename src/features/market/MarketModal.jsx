import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardCC } from '../../data/cards.js'
import Card from '../../components/Card.jsx'
import CollectionScroll from '../../components/CollectionScroll.jsx'
import { TxHistoryModal } from '../achievements/NotifComponents.jsx'
import { ThumbImage } from '../quiz/QuizComponents.jsx'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'
import { apiGetPriceCaps, apiGetOffseasonMarket } from '../../services/api.js'

// Coins par rareté : chaque rareté a son « coin » (bannière + devise) qui porte
// l'info de rareté, plutôt qu'un badge sur chaque carte. Ordre = RC[rarity].order.
const MERCHANTS = {
  légendaire: { nameKey: 'merchant_legendaire', taglineKey: 'merchant_tagline_legendaire' },
  épique:     { nameKey: 'merchant_epique',     taglineKey: 'merchant_tagline_epique' },
  rare:       { nameKey: 'merchant_rare',       taglineKey: 'merchant_tagline_rare' },
  commun:     { nameKey: 'merchant_commun',     taglineKey: 'merchant_tagline_commun' },
}

// Durée de mise en vente d'une annonce → libellé court (« Nouveau » < 24 h, puis
// « 2 j » jusqu'à 6 jours, puis « 1 sem », « 2 sem »…). Renvoie null si date absente.
function listingAgeLabel(listedAt, t) {
  if (!listedAt) return null
  const ms = Date.now() - new Date(listedAt).getTime()
  if (!(ms >= 0)) return null
  const days = Math.floor(ms / 86400000)
  if (days < 1) return { label: t('market_age_new'), isNew: true }
  if (days < 7) return { label: t('market_age_days').replace('{n}', days), isNew: false }
  return { label: t('market_age_weeks').replace('{n}', Math.floor(days / 7)), isNew: false }
}

function PanelWrapper({ inline, onClose, theme, children }) {
  if (inline) return <div style={{ fontFamily: "'Nunito',sans-serif" }}>{children}</div>
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#00000070', animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'relative', background: theme.bgSurface, width: 'min(100vw, 620px)', height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px #000c', borderLeft: `1px solid ${theme.border}`, fontFamily: "'Nunito',sans-serif", animation: 'slideFromRight .25s cubic-bezier(.2,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

export default function MarketModal({
  myCollection, market, onClose, onBuy, onListCard, loading = false,
  myListings, onCancelListing, onCancelAllListings, gold, cardPool, transactions = [],
  initialTab = 'acheter',
  initialSellCard = null,
  ranks = [],
  topSellerScores = {},
  marketSalesOpen = true,
  myPseudo = null,
  unreadSales = 0,
  onClearUnreadSales = () => {},
  onClearNewTransactions = () => {},
  inline = false,
  listingFee = 4,
  saleTax = 0.12,
  forgePoints = 0,
  onBuyOffseason = null,
}) {
  const { t } = useT()
  const { theme } = useTheme()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 620)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 620)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const [tab, setTab] = useState(initialTab)
  const [sellCard, setSellCard] = useState(initialSellCard)
  const [sellPrice, setSellPrice] = useState('')
  const [msg, setMsg] = useState('')
  const [priceCaps, setPriceCaps] = useState({})

  useEffect(() => {
    apiGetPriceCaps().then(({ data }) => { if (data?.caps) setPriceCaps(data.caps) }).catch(() => {})
  }, [])
  const [exp, setExp] = useState(null)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [buySearch, setBuySearch]         = useState('')  // index en attente de confirmation
  const [buySort, setBuySort]             = useState('price_asc')
  const [showMissing, setShowMissing]     = useState(false) // n'afficher que les geocoins non possédés (cf. Collection)
  const [onlyMine, setOnlyMine]           = useState(false) // n'afficher que les cartes où j'ai une annonce
  // Étals : un seul marchand déplié à la fois (null = tous pliés, état initial).
  const [expandedMerchant, setExpandedMerchant] = useState(null)
  const merchantRefs = useRef({})   // rareté -> nœud DOM du bloc marchand
  const flipPrev     = useRef(null) // rects capturés avant un changement à animer (FLIP)
  const [sellSearch, setSellSearch]       = useState('')
  const [sellSort, setSellSort]           = useState('rarity')
  // Marché « Hors saison » : geocoins de saisons terminées, vendus par le jeu.
  const [offItems, setOffItems]           = useState(null)  // null = pas encore chargé
  const [offOpen, setOffOpen]             = useState(true)
  const [offBuyingId, setOffBuyingId]     = useState(null)

  const loadOffseason = useCallback(() => {
    return apiGetOffseasonMarket().then(({ data }) => {
      setOffItems(data?.items || [])
      setOffOpen(data?.feature_open !== false)
    }).catch(() => { setOffItems([]) })
  }, [])

  useEffect(() => {
    if (tab === 'horssaison' && offItems === null) loadOffseason()
  }, [tab, offItems, loadOffseason])

  const myCards = Object.entries(myCollection)
    .filter(([, v]) => v > 1)
    .map(([id, cnt]) => ({ card: cardPool.find(c => c.id === +id), cnt }))
    .filter(x => x.card && x.card.sellable !== false)

  const ob = useMemo(() => {
    const g = {}
    market.forEach((l, i) => {
      const id = l.card.id
      if (!g[id]) g[id] = { card: l.card, tiers: {} }
      if (!g[id].tiers[l.price]) g[id].tiers[l.price] = { price: l.price, qty: 0, sellers: [], dates: [], indices: [] }
      g[id].tiers[l.price].qty++
      if (l.seller && g[id].tiers[l.price].sellers.length < 5) { g[id].tiers[l.price].sellers.push(l.seller); g[id].tiers[l.price].dates.push(l.listedAt ?? null) }
      g[id].tiers[l.price].indices.push(i)
    })
    Object.values(g).forEach(v => {
      v.tiersArr = Object.values(v.tiers).sort((a, b) => a.price - b.price)
      v.totalQty = v.tiersArr.reduce((s, t) => s + t.qty, 0)
      v.maxQty = Math.max(...v.tiersArr.map(t => t.qty))
    })
    return g
  }, [market])

  const myCardsFiltered = useMemo(() => {
    const q = sellSearch.trim().toLowerCase()
    const arr = q ? myCards.filter(({ card }) => card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q)) : [...myCards]
    const refPrice = (card) => ob[card.id]?.tiersArr?.[0]?.price ?? priceCaps[card.rarity]?.max ?? 0
    switch (sellSort) {
      case 'price_asc':
        return arr.sort((a, b) => refPrice(a.card) - refPrice(b.card))
      case 'price_desc':
        return arr.sort((a, b) => refPrice(b.card) - refPrice(a.card))
      default:
        return arr.sort((a, b) => RC[a.card.rarity].order - RC[b.card.rarity].order)
    }
  }, [myCards, sellSearch, sellSort, priceCaps, ob])

  const gArr = useMemo(() => {
    const arr = Object.values(ob)
    switch (buySort) {
      case 'price_asc':
        return arr.sort((a, b) => a.tiersArr[0].price - b.tiersArr[0].price)
      case 'price_desc':
        return arr.sort((a, b) => b.tiersArr[0].price - a.tiersArr[0].price)
      default:
        return arr.sort((a, b) => RC[a.card.rarity].order - RC[b.card.rarity].order)
    }
  }, [ob, buySort])

  const myListingCardIds = useMemo(() => new Set(myListings.map(l => l.card?.id)), [myListings])

  const tabs = [
    { id: 'acheter',    label: t('market_buy') },
    { id: 'vendre',     label: t('market_sell') },
    { id: 'horssaison', label: t('market_offseason') },
    { id: 'historique', label: t('market_history'), badge: unreadSales },
  ]

  const visitedHistoryRef = useRef(false)

  // Hauteur réelle du bloc figé (onglets + recherche en Acheter) : les bannières
  // collantes des coins s'y calent pour ne jamais passer dessous. ResizeObserver
  // car le bloc grandit/rétrécit selon l'onglet et les retours à la ligne.
  // COIN_GAP : espace constant entre le bloc figé et une bannière de coin,
  // identique au repos (marginTop de la liste) et une fois collée (offset sticky).
  const COIN_GAP = 15
  const stickyRef = useRef(null)
  const [stickyH, setStickyH] = useState(50)
  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const measure = () => setStickyH(el.offsetHeight || 50)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])


  useEffect(() => {
    if (tab === 'historique') {
      visitedHistoryRef.current = true
      if (unreadSales > 0) onClearUnreadSales()
    }
  }, [tab, unreadSales, onClearUnreadSales])

  useEffect(() => {
    return () => {
      if (visitedHistoryRef.current) onClearNewTransactions()
    }
  }, [onClearNewTransactions])

  // ── Réordonnancement animé du dépliage d'un coin (technique FLIP) ──────────
  // Réinitialise tout style FLIP résiduel (anim interrompue) pour éviter qu'un
  // transform fantôme ne décale un bloc → chevauchement / espace blanc.
  const clearFlip = (el) => { if (el) { el.style.transition = ''; el.style.transform = ''; el.style.zIndex = '' } }
  const captureMerchantRects = useCallback(() => {
    const rects = {}
    Object.entries(merchantRefs.current).forEach(([k, el]) => { if (el) { clearFlip(el); rects[k] = el.getBoundingClientRect() } })
    return rects
  }, [])

  const toggleMerchant = useCallback((rarity) => {
    flipPrev.current = captureMerchantRects()
    setExpandedMerchant(prev => (prev === rarity ? null : rarity))
  }, [captureMerchantRects])

  // Annule toutes mes annonces d'une rareté donnée. On déclenche tous les retraits
  // sur le snapshot courant de myListings (onCancelListing filtre par id → composable).
  const cancelRarity = useCallback((rarity) => {
    myListings.forEach((l, i) => { if (l.card?.rarity === rarity) onCancelListing(i) })
  }, [myListings, onCancelListing])

  // Après le re-render (nouvel ordre/hauteurs appliqués), on inverse le delta de
  // position puis on le laisse revenir à 0 → glissement fluide vers la nouvelle place.
  // N'anime que le dépliage d'un coin (flipPrev posé uniquement par toggleMerchant).
  useLayoutEffect(() => {
    const prev = flipPrev.current
    if (!prev) return
    flipPrev.current = null
    // À l'ouverture, le coin flotte en tête : on le ramène dans le champ de vision.
    // Calculé avant d'appliquer les transforms FLIP pour viser la position finale.
    if (expandedMerchant) {
      merchantRefs.current[expandedMerchant]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    Object.entries(merchantRefs.current).forEach(([k, el]) => {
      const p = prev[k]
      if (!el || !p) return
      const r = el.getBoundingClientRect()
      const dx = p.left - r.left
      const dy = p.top - r.top
      if (!dx && !dy) return
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px,${dy}px)`
      el.style.zIndex = '4'
      void el.offsetWidth // reflow pour ancrer la position inversée
      requestAnimationFrame(() => {
        el.style.transition = 'transform .42s cubic-bezier(.2,.7,.2,1)'
        el.style.transform = ''
      })
      // transitionend + fallback : on garantit le nettoyage même si l'event ne part pas.
      let done = false
      const finish = () => { if (done) return; done = true; clearFlip(el); el.removeEventListener('transitionend', finish) }
      el.addEventListener('transitionend', finish)
      setTimeout(finish, 550)
    })
  }, [expandedMerchant])

  return (
    <PanelWrapper inline={inline} onClose={onClose} theme={theme}>
      <div style={{ padding: '18px 20px', flex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 14 }}>
          <div style={{ color: theme.gold,fontWeight: 900,fontSize: 20 }}>{t('market_title')}</div>
          {!inline && <button onClick={onClose} style={{ background: '#ffffff22',border: 'none',color: '#fff',width: 32,height: 32,borderRadius: '50%',fontSize: 16,cursor: 'pointer' }}>✕</button>}
        </div>

        {/* Bloc figé pendant le défilement : onglets + (en Acheter) barre de
            recherche/filtres — sous le header de l'app en inline, en haut du
            panneau latéral sinon */}
        {/* En Acheter, pas de marge sous le bloc : l'écart avec les bannières de
            coins (15px, COIN_GAP) est porté par leur offset sticky et le marginTop
            de la liste → identique au repos et en défilement. */}
        <div ref={stickyRef} style={{ position: 'sticky', top: inline ? 'var(--header-h, 48px)' : 0, zIndex: 50, background: inline ? theme.bgMain : theme.bgSurface, padding: '4px 0 12px', marginBottom: tab === 'acheter' ? 0 : 16, boxShadow: '0 10px 14px -12px #000a' }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {tabs.map(tab_ => (
              <button key={tab_.id} onClick={() => { setTab(tab_.id); setMsg(''); setExp(null) }}
                style={{ position: 'relative', background: tab === tab_.id ? '#f9ca24' : theme.bgElevated, border: `1px solid ${tab === tab_.id ? '#f9ca24' : theme.border}`, color: tab === tab_.id ? '#1e3045' : theme.textPrimary, padding: '7px 15px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {tab_.label}
                {tab_.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#e74c3c', color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: '50%', padding: '2px 5px', border: `1.5px solid ${tab === tab_.id ? '#f9ca24' : '#1e3045'}`, animation: 'pulseBadge 1.5s infinite' }}>{tab_.badge}</span>}
              </button>
            ))}
          </div>

          {/* Recherche Acheter/Vendre — pleine largeur sur sa propre ligne pour être
              STRICTEMENT identique entre les deux onglets (les contrôles, différents
              d'un onglet à l'autre, vivent sur la ligne du dessous). Le ✕ d'effacement
              est superposé pour ne pas faire varier la largeur de l'input. */}
          {(tab === 'acheter' || (tab === 'vendre' && myCards.length > 0)) && (
            <div style={{ position: 'relative', marginTop: 12 }}>
              <input
                value={tab === 'acheter' ? buySearch : sellSearch}
                onChange={e => { if (tab === 'acheter') { setExpandedMerchant(null); setBuySearch(e.target.value) } else setSellSearch(e.target.value) }}
                placeholder={t('collection_search')}
                style={{ width: '100%', boxSizing: 'border-box', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textPrimary, padding: '7px 32px 7px 11px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none' }}/>
              {(tab === 'acheter' ? buySearch : sellSearch) && (
                <button onClick={() => tab === 'acheter' ? setBuySearch('') : setSellSearch('')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
              )}
            </div>
          )}

          {/* Contrôles Acheter — tri + filtres, sous la recherche */}
          {tab === 'acheter' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <select value={buySort} onChange={e => setBuySort(e.target.value)}
                style={{ flexShrink: 0, background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textSecondary, padding: '7px 11px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="price_asc">{t('market_sort_price_asc')}</option>
                <option value="price_desc">{t('market_sort_price_desc')}</option>
              </select>
              {/* Manquants / Tous — même système que la Collection ; désactivé en vue « Mes annonces » */}
              <button disabled={onlyMine} onClick={() => { setExpandedMerchant(null); setShowMissing(v => !v) }}
                style={{ flexShrink: 0, background: showMissing ? '#6c5ce7' : theme.bgInput, border: `1px solid ${showMissing ? '#6c5ce7' : theme.border}`, color: showMissing ? '#fff' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: onlyMine ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: onlyMine ? 0.45 : 1 }}>
                {showMissing ? t('filter_all') : t('filter_missing')}
              </button>
              {/* Mes annonces — désactive le filtre Manquants (incompatible) */}
              <button onClick={() => { setExpandedMerchant(null); setShowMissing(false); setOnlyMine(v => !v) }}
                style={{ flexShrink: 0, background: onlyMine ? '#f9ca24' : theme.bgInput, border: `1px solid ${onlyMine ? '#f9ca24' : theme.border}`, color: onlyMine ? '#1e3045' : theme.textSecondary, padding: '7px 11px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t('market_only_mine')}{myListings.length ? ` (${myListings.length})` : ''}
              </button>
            </div>
          )}

          {/* Contrôles Vendre — tri, sous la recherche */}
          {tab === 'vendre' && myCards.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <select value={sellSort} onChange={e => setSellSort(e.target.value)}
                style={{ flexShrink: 0, background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textSecondary, padding: '7px 11px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="rarity">{t('market_sort_label')}: {t('market_sort_rarity')}</option>
                <option value="price_asc">{t('market_sort_label')}: {t('market_sort_price_asc')}</option>
                <option value="price_desc">{t('market_sort_label')}: {t('market_sort_price_desc')}</option>
              </select>
            </div>
          )}
        </div>

        {/* ── ACHETER ── (la barre de recherche vit dans le bloc figé ci-dessus) */}
        {tab === 'acheter' && (
          <div>
            {(() => {
              const q = buySearch.trim().toLowerCase()
              let filtered = q ? gArr.filter(({ card }) => card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q)) : gArr
              if (onlyMine) filtered = filtered.filter(({ card }) => myListingCardIds.has(card.id))
              if (showMissing) filtered = filtered.filter(({ card }) => !((myCollection[card.id] || 0) > 0))
              // Recherche ou « mes annonces » = vue à plat : tous les coins dépliés, non repliables.
              const flat = !!q || onlyMine
              if (filtered.length === 0) return (
                (loading && !flat && !showMissing) ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0', gap: 10 }}>
                    <style>{`@keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-8px);opacity:1}}`}</style>
                    {[0, 0.18, 0.36].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />)}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                    <div style={{ fontSize: 36 }}>{onlyMine ? '📭' : '🏜️'}</div>
                    <div style={{ marginTop: 8 }}>{onlyMine ? t('market_no_listings') : t('market_empty')}</div>
                  </div>
                )
              )
              // Regroupement des ventes par marchand (= rareté).
              const merchantGroups = {}
              filtered.forEach(g => { (merchantGroups[g.card.rarity] ||= []).push(g) })
              // Ordre de base : commun → rare → épique → légendaire (RC.order décroissant).
              const baseOrder = Object.keys(merchantGroups).sort((a, b) => RC[b].order - RC[a].order)
              // En vue à plat, l'étal déplié ne flotte pas ; sinon il passe au-dessus des autres.
              const displayOrder = (!flat && expandedMerchant && merchantGroups[expandedMerchant])
                ? [expandedMerchant, ...baseOrder.filter(r => r !== expandedMerchant)]
                : baseOrder
              // gap réduit : chaque coin porte déjà COIN_GAP en paddingTop opaque
              // (cache sticky), au repos comme en défilement.
              return (
              <div style={{ display: 'flex',flexDirection: 'column',gap: 6 }}>
                <style>{`@keyframes stallReveal{from{clip-path:inset(0 0 100% 0);opacity:.35}to{clip-path:inset(0 0 0 0);opacity:1}}`}</style>
                {displayOrder.map(rarity => {
                  const m = MERCHANTS[rarity]
                  const mc = cardCC(rarity)
                  const groupCards = merchantGroups[rarity]
                  const stock = groupCards.reduce((s, g) => s + g.totalQty, 0)
                  const isExpanded = flat ? true : expandedMerchant === rarity
                  return (
                  <div key={rarity} ref={el => { merchantRefs.current[rarity] = el }} style={{ scrollMarginTop: inline ? `calc(var(--header-h, 48px) + ${stickyH + 4}px)` : stickyH + 4 }}>
                    {/* Bannière du coin — collante à COIN_GAP sous le bloc figé pendant le
                        scroll de son étal. Le conteneur sticky porte l'espace COIN_GAP en
                        paddingTop OPAQUE (fond de page) : les lignes de l'étal disparaissent
                        en passant derrière au lieu de rester visibles dans l'interstice. */}
                    <div style={{ position: flat ? 'static' : 'sticky', top: inline ? `calc(var(--header-h, 48px) + ${stickyH}px)` : stickyH, zIndex: 3, paddingTop: COIN_GAP, background: inline ? theme.bgMain : theme.bgSurface, marginBottom: isExpanded ? 11 : 0 }}>
                    <div onClick={() => { if (!flat) toggleMerchant(rarity) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, cursor: flat ? 'default' : 'pointer', background: `linear-gradient(135deg,${mc.c1},${mc.c2})`, boxShadow: `0 4px 16px ${mc.c1}44` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', textShadow: '0 1px 3px #0006' }}>{t(m.nameKey)}</div>
                        <div style={{ fontSize: 10.5, color: '#ffffffd0', fontStyle: 'italic', textShadow: '0 1px 2px #0005', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>« {t(m.taglineKey)} »</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ background: '#00000038', color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 10px', borderRadius: 50, whiteSpace: 'nowrap', border: '1px solid #ffffff33' }}>{stock.toLocaleString()} {t('market_for_sale')}</span>
                        {/* Tout retirer — par coin, uniquement en vue « Mes annonces » */}
                        {onlyMine && (cancelConfirm === `coin_${rarity}` ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={(e) => { e.stopPropagation(); cancelRarity(rarity); setCancelConfirm(null) }}
                              style={{ background: '#d63031', border: '1px solid #ffffff66', color: '#fff', fontWeight: 900, fontSize: 11, padding: '4px 9px', borderRadius: 50, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>✓</button>
                            <button onClick={(e) => { e.stopPropagation(); setCancelConfirm(null) }}
                              style={{ background: '#00000040', border: '1px solid #ffffff44', color: '#fff', fontWeight: 800, fontSize: 11, padding: '4px 8px', borderRadius: 50, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setCancelConfirm(`coin_${rarity}`) }}
                            style={{ background: '#00000040', border: '1px solid #ffffff55', color: '#fff', fontWeight: 800, fontSize: 10, padding: '4px 10px', borderRadius: 50, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Nunito',sans-serif" }}>✕ {t('market_remove_all')}</button>
                        ))}
                        {!flat && <div style={{ color: '#fff', fontSize: 16, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}>⌄</div>}
                      </div>
                    </div>
                    </div>
                    {/* Étal du marchand */}
                    {isExpanded && (
                    <div style={{ display: 'flex',flexDirection: 'column',gap: 9, animation: 'stallReveal .42s cubic-bezier(.2,.7,.2,1) both' }}>
                      {groupCards.map(({ card, tiersArr, totalQty, maxQty }) => {
                        const isO = exp === card.id
                        const { c1, c2 } = cardCC(card.rarity)
                        const owned = (myCollection[card.id] || 0) > 0
                        return (
                    <div key={card.id} style={{ background: theme.overlay,border: isO ? `1.5px solid #f9ca2455` : `1.5px solid ${theme.border}`,borderRadius: 13,overflow: 'hidden' }}>
                      <div onClick={() => setExp(isO ? null : card.id)} style={{ display: 'flex',alignItems: 'center',gap: 11,padding: '9px 13px',cursor: 'pointer' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden', background: `linear-gradient(135deg,${c1},${c2})`, border: `1.5px solid ${c1}66` }}>
                            {(card.image_url_thumb || card.image_url)
                              ? <ThumbImage src={card.image_url_thumb || card.image_url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{card.name[0]}</div>
                            }
                          </div>
                          {owned && <div title={t('market_already_owned')} style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#00b894', border: `2px solid ${theme.bgSurface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900, lineHeight: 1, boxShadow: '0 1px 3px #0006' }}>✓</div>}
                        </div>
                        <div style={{ flex: 1,minWidth: 0 }}>
                          <div style={{ display: 'flex',alignItems: 'center',gap: 7,flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 900,fontSize: 14,color: theme.textPrimary }}>{card.name}</span>
                          </div>
                          <div style={{ fontSize: 10,color: theme.textMuted,marginTop: 2,display: 'flex',gap: 10,flexWrap: 'wrap' }}>
                            <span style={{ color: theme.gold,fontWeight: 800 }}>{totalQty.toLocaleString()} {t('market_for_sale')}</span>
                            <span>{t('market_from')} <span style={{ color: '#00b894',fontWeight: 800 }}>{tiersArr[0].price}G</span></span>
                          </div>
                        </div>
                        <div style={{ color: isO ? '#f9ca24' : '#666',fontSize: 17,transform: isO ? 'rotate(180deg)' : 'none',flexShrink: 0,transition: 'transform .25s' }}>⌄</div>
                      </div>
                      {isO && (
                        <div style={{ borderTop: `1px solid ${theme.border}`,padding: '9px 13px 11px',display: 'flex',flexDirection: 'column',gap: 4 }}>
                          <div style={{ display: 'grid',gridTemplateColumns: '65px 1fr 50px auto',gap: 5,padding: '0 3px 4px',borderBottom: `1px solid ${theme.border}`,fontSize: 9,color: theme.textMuted,fontWeight: 700,textTransform: 'uppercase' }}>
                            <span>{t('market_price')}</span><span>{t('market_volume')}</span><span style={{ textAlign: 'right' }}>{t('market_qty')}</span><span style={{ textAlign: 'right' }}>{t('market_buy_btn')}</span>
                          </div>
                          {tiersArr.slice(0, 5).map((tier, i) => {
                            const bp = maxQty > 0 ? (tier.qty / maxQty * 100) : 0
                            const ca = gold >= tier.price
                            const ib = i === 0
                            // Propriété du palier déterminée d'abord via myListings (source fiable,
                            // non tronquée) : la liste `sellers` est plafonnée à 5 côté serveur, donc
                            // un vendeur au-delà du 5e (fréquent sur les légendaires regroupés au prix
                            // plancher) n'y figure pas. On retombe sur le pseudo en secours.
                            const myIdx = myListings.findIndex(m => m.card?.id === card.id && m.price === tier.price)
                            const isOwn = myIdx >= 0 || (myPseudo && tier.sellers.includes(myPseudo))
                            return (
                              <div key={tier.price} style={{ display: 'grid',gridTemplateColumns: '65px 1fr 50px auto',gap: 5,alignItems: 'center',padding: '4px 3px',borderRadius: 6,background: isOwn ? '#f9ca2408' : ib ? '#00b89412' : 'transparent',border: isOwn ? '1px solid #f9ca2428' : ib ? '1px solid #00b89428' : '1px solid transparent', opacity: ca ? 1 : 0.4 }}>
                                <div style={{ fontWeight: 900,fontSize: 13,color: isOwn ? theme.gold : ib ? '#00b894' : theme.textPrimary,display: 'flex',alignItems: 'center',gap: 3,flexWrap: 'wrap' }}>
                                  {isOwn && <span style={{ fontSize: 7,background: '#f9ca24',color: '#1e3045',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>Moi</span>}
                                  {!isOwn && ib && <span style={{ fontSize: 7,background: '#00b894',color: '#fff',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>{t('market_best')}</span>}
                                  {tier.price}G
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ background: theme.overlayMd,borderRadius: 3,height: 5,overflow: 'hidden',marginBottom: 2 }}>
                                    <div style={{ width: `${bp}%`, height: '100%', background: ib ? 'linear-gradient(90deg,#00b894,#00cec9)' : `linear-gradient(90deg,${c1}88,${c2}88)`, borderRadius: 3, transition: 'width .4s' }} />
                                  </div>
                                  <div style={{ fontSize: 9,color: theme.textMuted,whiteSpace: 'nowrap',overflow: 'hidden',textOverflow: 'ellipsis' }}>
                                    {tier.sellers.slice(0, 3).map((s, si) => {
                                      const age = listingAgeLabel(tier.dates?.[si], t)
                                      return (
                                      <span key={si}>{si > 0 && ', '}
                                        <PseudoDisplay pseudo={s} score={topSellerScores[s] || 0} ranks={ranks} tag="span" style={{ fontSize: 9 }}/>
                                        {age && <span style={{ marginLeft: 3, color: age.isNew ? '#00b894' : theme.textMuted, fontWeight: age.isNew ? 800 : 600 }}>· {age.label}</span>}
                                      </span>
                                      )
                                    })}{tier.qty > tier.sellers.length ? ` +${tier.qty - tier.sellers.length}` : ''}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right',fontWeight: 800,color: theme.textSecondary,fontSize: 11 }}>{tier.qty.toLocaleString()}</div>
                                <div style={{ textAlign: 'right' }}>
                                  {isOwn ? (() => {
                                    // Retirer directement SON annonce de ce palier (carte + prix) sans passer par « Mes annonces ».
                                    if (myIdx < 0) return <span style={{ fontSize: 9,color: theme.gold,fontWeight: 700,opacity: .7 }}>Votre annonce</span>
                                    return cancelConfirm === `buy_${myIdx}` ? (
                                      <div style={{ display: 'flex',gap: 4,justifyContent: 'flex-end' }}>
                                        <button onClick={() => { onCancelListing(myIdx); setCancelConfirm(null) }}
                                          style={{ background: 'linear-gradient(135deg,#d63031,#e17055)',border: 'none',color: '#fff',padding: '5px 9px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 900,fontSize: 11,cursor: 'pointer' }}>✓</button>
                                        <button onClick={() => setCancelConfirm(null)}
                                          style={{ background: theme.bgElevated,border: `1px solid ${theme.border}`,color: theme.textMuted,padding: '5px 8px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer' }}>✕</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setCancelConfirm(`buy_${myIdx}`)}
                                        style={{ background: '#e74c3c22',border: '1px solid #e74c3c44',color: '#e74c3c',padding: '5px 9px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 10,cursor: 'pointer',whiteSpace: 'nowrap' }}>{t('market_remove')}</button>
                                    )
                                  })() : (
                                    <button
                                      onClick={() => {
                                        if (owned && !window.confirm(t('market_duplicate_confirm').replace('{card}', card.name))) return
                                        // Utiliser le listing complet depuis market[] pour avoir l'id DB
                                        const fullListing = market[tier.indices[0]] || { seller: tier.sellers[0], card, price: tier.price }
                                        onBuy(fullListing, tier.indices[0])
                                      }}
                                      disabled={!ca}
                                    style={{ background: ca ? 'linear-gradient(135deg,#00b894,#00cec9)' : theme.bgElevated, border: `1px solid ${ca ? 'transparent' : theme.border}`, color: ca ? '#fff' : theme.textMuted, padding: '5px 9px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: ca ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                                    {ca ? t('market_buy_btn') : t('market_insufficient')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {tiersArr.length > 5 && (
                            <div style={{ textAlign: 'center', fontSize: 10, color: '#888', marginTop: 4, fontStyle: 'italic' }}>
                              + {tiersArr.length - 5} autre{tiersArr.length - 5 > 1 ? 's' : ''} proposition{tiersArr.length - 5 > 1 ? 's' : ''} plus chère{tiersArr.length - 5 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
              )
            })()}
          </div>
        )}

        {/* ── VENDRE ── */}
        {tab === 'vendre' && (
          <div style={{ display: 'flex',gap: 18,flexWrap: 'wrap' }}>
          {!marketSalesOpen && (
            <div style={{ width: '100%', background: '#e74c3c18', border: '1px solid #e74c3c44', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div>
                <div style={{ fontWeight: 900, color: '#e74c3c', fontSize: 13 }}>{t('market_sales_closed_title')}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{t('market_sales_closed_desc')}</div>
              </div>
            </div>
          )}
            <div style={{ flex: 2,minWidth: 220 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10, padding: '7px 10px', background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 8 }}>
                ℹ️ {t('market_no_duplicates_hint2')}
              </div>
              {myCards.length === 0 ? (
                <div style={{ color: theme.textMuted,padding: '16px 0',textAlign: 'center',fontSize: 13 }}>
                  {t('market_no_duplicates')}
                </div>
              ) : (
                <CollectionScroll items={myCardsFiltered} batch={24} theme={theme} isMobile={isMobile} topLabel={t('coll_back_top')}
                  resetKey={`${sellSearch}|${sellSort}`}
                  renderItem={({ card, cnt }) => (
                    <Card key={card.id} card={card} count={cnt} small selected={sellCard?.id === card.id}
                      onClick={() => { setSellCard(sellCard?.id === card.id ? null : card); setSellPrice(''); setMsg('') }} />
                  )} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180, order: isMobile ? -1 : 0 }}>
              {sellCard ? (
                // Se cale sous le bloc figé (onglets + recherche, hauteur mesurée)
                // avec le même espace constant que les coins de l'onglet Acheter.
                <div style={{ position: isMobile ? 'static' : 'sticky', top: isMobile ? 0 : (inline ? `calc(var(--header-h, 48px) + ${stickyH + COIN_GAP}px)` : stickyH + COIN_GAP), marginTop: isMobile ? 12 : 0 }}>
                <div style={{ background: theme.overlay, border: `1.5px solid ${theme.border}`, borderRadius: 15, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Carte sélectionnée */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Card card={sellCard} /></div>

                  {/* Prix */}
                  {(() => {
                    const cap = priceCaps[sellCard.rarity]
                    const lowestPrice = ob[sellCard.id]?.tiersArr?.[0]?.price || 0
                    const maxPrice = cap?.max != null ? Math.max(cap.max, sellCard.minPrice || 0, lowestPrice) : null
                    const overCap = maxPrice !== null && +sellPrice > maxPrice
                    const underMin = sellCard.minPrice && +sellPrice < sellCard.minPrice
                    const noFeeGold = gold < listingFee
                    const invalid = !(+sellPrice > 0) || underMin || overCap || noFeeGold
                    return (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, display: 'block', marginBottom: 6 }}>{t('market_price_label')}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                          <input type="text" inputMode="numeric" pattern="[0-9]*" value={sellPrice} placeholder="0"
                            onChange={e => { setSellPrice(e.target.value.replace(/[^0-9]/g, '')); setMsg('') }}
                            style={{ flex: 1, background: theme.bgInput, border: `1px solid ${overCap ? '#e74c3c' : theme.border}`, borderRight: 'none', color: overCap ? '#e74c3c' : theme.textPrimary, padding: '9px 12px', borderRadius: '8px 0 0 8px', fontFamily: "'Nunito',sans-serif", fontSize: 16, fontWeight: 900, outline: 'none', transition: 'border-color .2s, color .2s' }} />
                          <span style={{ background: theme.bgElevated, border: `1px solid ${overCap ? '#e74c3c' : theme.border}`, color: theme.textMuted, padding: '9px 12px', borderRadius: '0 8px 8px 0', fontWeight: 800, fontSize: 14 }}>G</span>
                        </div>
                        {(() => {
                          const lowestPrice = ob[sellCard.id]?.tiersArr?.[0]?.price
                          if (!lowestPrice) return null
                          const targetPrice = Math.max(sellCard.minPrice || 1, lowestPrice)
                          return (
                            <button onClick={() => { setSellPrice(String(targetPrice)); setMsg('') }}
                              style={{ marginTop: 6, background: 'none', border: 'none', color: '#00b894', padding: 0, fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', display: 'block' }}>
                              {t('market_lowest_price')} {targetPrice}G
                            </button>
                          )
                        })()}
                        <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                          {sellCard.minPrice && (
                            <div style={{ fontSize: 10, color: theme.textMuted }}>{t('market_min_price')} {sellCard.minPrice}G</div>
                          )}
                          {maxPrice !== null && (
                            <div style={{ fontSize: 10, color: overCap ? '#e74c3c' : '#f39c12', fontWeight: overCap ? 800 : 700 }}>
                              {t('market_max_price')} {maxPrice}G
                              {cap.sales_count === 0 && <span style={{ color: theme.textMuted }}> *</span>}
                            </div>
                          )}
                        </div>
                        {overCap && (
                          <div style={{ marginTop: 5, fontSize: 10, color: '#e74c3c', fontWeight: 800 }}>
                            {t('market_cap_exceeded').replace('{max}', maxPrice)}
                          </div>
                        )}

                        {/* Récapitulatif frais + taxe */}
                        {+sellPrice > 0 && (
                          <div style={{ marginTop: 8, padding: '8px 10px', background: theme.overlayMd, borderRadius: 8, fontSize: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e74c3c' }}>
                              <span>{t('market_fee_label')} <span style={{ opacity: .7 }}>({t('market_fee_nonrefund')})</span></span>
                              <span style={{ fontWeight: 800 }}>−{listingFee}G</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e17055' }}>
                              <span>{t('market_tax_label')} ({Math.round(saleTax * 100)}%)</span>
                              <span style={{ fontWeight: 800 }}>−{Math.ceil(+sellPrice * saleTax)}G</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00b894', fontWeight: 900, borderTop: `1px solid ${theme.border}`, paddingTop: 3, marginTop: 1 }}>
                              <span>{t('market_you_receive')}</span>
                              <span>{Math.floor(+sellPrice * (1 - saleTax))}G</span>
                            </div>
                          </div>
                        )}

                        {msg && <div style={{ color: msg.startsWith('❌') ? '#e74c3c' : '#00b894', fontWeight: 800, fontSize: 11, marginTop: 4 }}>{msg}</div>}

                        <button
                          disabled={invalid}
                          onClick={async () => {
                            setMsg('')
                            const cardToList = sellCard
                            const error = await onListCard(cardToList, +sellPrice, myPseudo)
                            if (error) { setMsg('❌ ' + error); return }
                            // Rester sur l'onglet « Vendre » pour enchaîner plusieurs mises en
                            // vente sans clic supplémentaire ; le toast confirme la mise en vente.
                            setSellCard(null); setSellPrice('')
                          }}
                          style={{ width: '100%', marginTop: 4, background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045', padding: '11px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: invalid ? 'not-allowed' : 'pointer', opacity: invalid ? 0.5 : 1 }}>
                          {t('market_list_btn')}
                        </button>
                      </div>
                    )
                  })()}
                </div>
                </div>
              ) : (
                <div style={{ background: theme.overlay,border: `1.5px dashed ${theme.border}`,borderRadius: 15,padding: 22,textAlign: 'center',color: theme.textMuted }}>
                  <div style={{ fontSize: 32 }}>👈</div>
                  <div style={{ marginTop: 7,fontSize: 12 }}>{t('market_select_hint')}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HORS SAISON — geocoins de saisons terminées, vendus par le jeu ── */}
        {tab === 'horssaison' && (
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 12, padding: '8px 11px', background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>🗓️</span>
              <span>{t('market_offseason_hint')}</span>
            </div>
            {!offOpen ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                <div style={{ fontSize: 36 }}>🔒</div>
                <div style={{ marginTop: 8 }}>{t('market_offseason_closed')}</div>
              </div>
            ) : offItems === null ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0', gap: 10 }}>
                <style>{`@keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-8px);opacity:1}}`}</style>
                {[0, 0.18, 0.36].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />)}
              </div>
            ) : offItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                <div style={{ fontSize: 36 }}>🏜️</div>
                <div style={{ marginTop: 8 }}>{t('market_offseason_empty')}</div>
              </div>
            ) : (() => {
              // Regroupement par marchand = rareté (commun → légendaire).
              const groups = {}
              offItems.forEach(it => { (groups[it.card.rarity] ||= []).push(it) })
              const order = Object.keys(groups).sort((a, b) => RC[a].order - RC[b].order)
              const doBuy = async (it) => {
                if (!onBuyOffseason || offBuyingId) return
                if (it.owned && !window.confirm(t('market_duplicate_confirm').replace('{card}', it.card.name))) return
                setOffBuyingId(it.card.id)
                const error = await onBuyOffseason(it)
                setOffBuyingId(null)
                if (!error) loadOffseason()
              }
              // Liste aplatie (bannière de marchand puis ses articles) → défilement
              // continu par lots, comme la collection.
              const rows = order.flatMap(rarity => [
                { kind: 'header', rarity, count: groups[rarity].length },
                ...groups[rarity].map(it => ({ kind: 'item', it })),
              ])
              return (
                <CollectionScroll items={rows} batch={20} layout="list" theme={theme} isMobile={isMobile} topLabel={t('coll_back_top')} showCount={false}
                  renderItem={(row) => {
                    if (row.kind === 'header') {
                      const m  = MERCHANTS[row.rarity]
                      const mc = cardCC(row.rarity)
                      return (
                        <div key={`h_${row.rarity}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, marginTop: 9, background: `linear-gradient(135deg,${mc.c1},${mc.c2})`, boxShadow: `0 4px 16px ${mc.c1}44` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', textShadow: '0 1px 3px #0006' }}>{t(m.nameKey)}</div>
                            <div style={{ fontSize: 10.5, color: '#ffffffd0', fontStyle: 'italic', textShadow: '0 1px 2px #0005', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>« {t(m.taglineKey)} »</div>
                          </div>
                          <span style={{ background: '#00000038', color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 10px', borderRadius: 50, border: '1px solid #ffffff33', flexShrink: 0 }}>{row.count}</span>
                        </div>
                      )
                    }
                    const it = row.it
                    const { c1, c2 } = cardCC(it.card.rarity)
                    const canGold = gold >= it.gold_cost
                    const canPf   = forgePoints >= it.pf_cost
                    const canBuy  = canGold && canPf && !offBuyingId
                    return (
                      <div key={it.card.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', background: theme.overlay, border: `1.5px solid ${theme.border}`, borderRadius: 13 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', background: `linear-gradient(135deg,${c1},${c2})`, border: `1.5px solid ${c1}66` }}>
                            {(it.card.image_url_thumb || it.card.image_url)
                              ? <ThumbImage src={it.card.image_url_thumb || it.card.image_url} alt={it.card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{it.card.name[0]}</div>}
                          </div>
                          {it.owned && <div title={t('market_already_owned')} style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#00b894', border: `2px solid ${theme.bgSurface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900, lineHeight: 1, boxShadow: '0 1px 3px #0006' }}>✓</div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 14, color: theme.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.card.name}</div>
                          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            {it.season_name && <span style={{ fontStyle: 'italic' }}>{it.season_name}</span>}
                            <span style={{ color: canGold ? theme.gold : '#e74c3c', fontWeight: 800 }}>{it.gold_cost.toLocaleString()}G</span>
                            <span style={{ color: canPf ? '#a29bfe' : '#e74c3c', fontWeight: 800 }}>{it.pf_cost} PF</span>
                          </div>
                        </div>
                        <button onClick={() => doBuy(it)} disabled={!canBuy}
                          style={{ background: canBuy ? 'linear-gradient(135deg,#00b894,#00cec9)' : theme.bgElevated, border: `1px solid ${canBuy ? 'transparent' : theme.border}`, color: canBuy ? '#fff' : theme.textMuted, padding: '6px 12px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: canBuy ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {offBuyingId === it.card.id ? '…' : (canGold && canPf) ? t('market_buy_btn') : t('market_insufficient')}
                        </button>
                      </div>
                    )
                  }} />
              )
            })()}
          </div>
        )}

        {/* ── HISTORIQUE — toutes les ventes/achats, chargés au fil du défilement ── */}
        {tab === 'historique' && (
          <TxHistoryModal transactions={transactions} onClose={onClose} embedded cardPool={cardPool} saleTax={saleTax} />
        )}

      </div>
    </PanelWrapper>
  )
}
