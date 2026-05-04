import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ACHIEVEMENT_DEF } from '../data/cards.js'
import { INIT_LIMITS } from '../data/constants.js'
import { collScore } from '../utils/gameUtils.js'
import {
  apiGetCards, apiGetCollection, apiGetMarket, apiGetMyListings,
  apiBuyCard, apiListCard, apiCancelListing, apiGetTransactions,
  apiPingProfile, apiSetConfig, apiGetAdminConfig, apiGetPublicConfig,
  apiAdminAddCard, apiAdminEditCard, apiAdminDeleteCard, apiAdminDeleteType, apiAdminRenameType,
  apiGrantAchievement,
} from '../services/api.js'


export function useGameState(auth) {
  const profile = auth?.profile

  // ── World state ────────────────────────────────────────────────────────────
  const [cardPool,    setCardPool]    = useState([])
  const [cardTypes,   setCardTypes]   = useState([])
  const [market,      setMarket]      = useState([])
  const [players,     setPlayers]     = useState([])
  const [bannedIPs,   setBannedIPs]   = useState([])
  const [limits,      setLimits]      = useState(INIT_LIMITS)
  const [maintenance, setMaintenance] = useState({ on: false, text: '' })
  const [loadingData, setLoadingData] = useState(false)

  // ── Player state ───────────────────────────────────────────────────────────
  const [gold,         setGold]        = useState(profile?.gold ?? 0)
  const [collection,   setCollection]  = useState({})
  const [myListings,   setMyListings]  = useState([])
  const [dailyGold,    setDailyGold]   = useState(0)
  const [dailyCards,   setDailyCards]  = useState(0)
  const [totalBuys,    setTotalBuys]   = useState(0)
  const [totalSells,   setTotalSells]  = useState(0)
  const [streak,       setStreak]      = useState(0)
  const [transactions, setTransactions]= useState([])
  const [unlockedAch,  setUnlockedAch] = useState([])
  const [pendingAch,   setPendingAch]  = useState([])
  const [saleNotifs,   setSaleNotifs]  = useState([])
  const [unreadSales,  _setUnreadSales] = useState(0)
  const [showBanner,   setShowBanner]  = useState(true)

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // Verrou synchrone pour les achievements — évite les doublons en cas de double appel ou de StrictMode
  const unlockedAchRef = useRef(new Set())

  const setUnreadSales = useCallback((val) => {
    _setUnreadSales(val)
  }, [])

  const clearNewTransactions = useCallback(() => {
    if (profile) localStorage.setItem(`last_read_tx_${profile.id}`, Date.now().toString())
    setTransactions(prev => {
      if (!prev.some(tx => tx.isNew)) return prev;
      return prev.map(tx => tx.isNew ? { ...tx, isNew: false } : tx);
    })
  }, [profile])

  // ── Config publique — chargée pour TOUS les utilisateurs (même invités) ──
  useEffect(() => {
    apiGetPublicConfig().then(({ data: pubCfg }) => {
      if (pubCfg?.config && mounted.current) {
        const cfg = pubCfg.config
        setMaintenance({
          on: cfg.maintenance === 'true' || cfg.maintenance === true,
          text: cfg.maintenance_text || ''
        })
        setLimits(prev => ({
          ...prev,
          quizInterval:      cfg.quiz_interval       ?? prev.quizInterval,
          quizDuration:      cfg.quiz_duration       ?? prev.quizDuration,
          quizRarityRates:   cfg.quiz_rarity_rates   ?? prev.quizRarityRates,
          playerRanks:       cfg.player_ranks        ?? prev.playerRanks,
          marketSalesOpen:   cfg.market_sales_open   ?? prev.marketSalesOpen,
          maxActiveListings: cfg.max_active_listings ?? prev.maxActiveListings,
          botsVisible:       cfg.bots_visible        ?? prev.botsVisible,
        }))
      }
    })
  }, [])

  // ── Charger les données depuis l'API quand le profil change ───────────────
  useEffect(() => {
    if (!profile) {
      // Logout — réinitialiser tout l'état joueur
      setGold(0); setCollection({}); setMarket([]); setMyListings([])
      setTransactions([]); setTotalBuys(0); setTotalSells(0); setStreak(0)
      _setUnreadSales(0); setSaleNotifs([]); setUnlockedAch([]); setPendingAch([])
      return
    }
    setGold(profile.gold ?? 0)
    setStreak(profile.streak ?? 0)

    async function loadAll() {
      setLoadingData(true)
      try {
        // Cartes — retry automatique si réponse vide (cache stale possible)
        let cardsResult = await apiGetCards()
        if (!cardsResult.data?.cards?.length) {
          await new Promise(r => setTimeout(r, 1000))
          cardsResult = await apiGetCards()
        }
        if (cardsResult.data?.cards?.length && mounted.current) {
          // Normaliser noms de colonnes DB → noms frontend (desc/image/minPrice)
          const normalized = cardsResult.data.cards.map(c => ({
            ...c,
            desc:     c.desc     ?? c.description ?? '',
            image:    c.image    ?? c.image_url   ?? null,
          thumbnail: c.thumbnail ?? c.image_url_thumb ?? null,
            minPrice: c.minPrice ?? c.min_price   ?? null,
          }))
          setCardPool(normalized)
          const types = [...new Set(normalized.map(c => c.type).filter(t => t !== 'Achievement'))]
          setCardTypes(types)
        }

        // Collection
        const { data: colData } = await apiGetCollection()
        if (colData?.collection && mounted.current) {
          setCollection(colData.collection)
          // Pré-remplir depuis les cartes achievement déjà en collection
          const alreadyUnlocked = ACHIEVEMENT_DEF
            .filter(def => (colData.collection[def.cardId] || 0) > 0)
            .map(def => def.id)
          alreadyUnlocked.forEach(id => unlockedAchRef.current.add(id))
          if (alreadyUnlocked.length) setUnlockedAch(alreadyUnlocked)
        }

        // Marché
        const { data: mktData } = await apiGetMarket()
        if (mktData?.market && mounted.current) {
          // Convertir format API → format interne (tableau de listings plats)
          const flat = []
          mktData.market.forEach(({ card, tiers }) => {
            tiers.forEach(tier => {
              tier.ids.forEach((id, i) => {
                flat.push({ id, card, price: tier.price, seller: tier.sellers[i] || tier.sellers[0] })
              })
            })
          })
          setMarket(flat)
        }

        // Mes annonces
        const { data: listData } = await apiGetMyListings()
        if (listData?.listings && mounted.current) {
          setMyListings(listData.listings.map(l => ({
            id: l.id, card: l.cards, price: l.price,
          })))
        }

        // Transactions + compteurs persistés (achats/ventes)
        const { data: txData } = await apiGetTransactions({ limit: 500 })
        if (txData?.transactions && mounted.current) {
          const lastRead = parseFloat(localStorage.getItem(`last_read_tx_${profile.id}`) || '0')
          let newSalesCount = 0
          setTransactions(txData.transactions.map(tx => {
            const txTime = new Date(tx.created_at).getTime()
            const isNew = tx.type === 'vente' && txTime > lastRead
            if (isNew) newSalesCount++
            return {
              type: tx.type, cardName: tx.card_name, rarity: tx.rarity,
              counterpart: tx.counterpart, price: tx.price,
              date: new Date(tx.created_at).toLocaleDateString('fr-FR'),
              isNew
            }
          }))
          if (newSalesCount > 0) _setUnreadSales(newSalesCount)
          // Recalculer les compteurs depuis la DB pour éviter de perdre l'état
          const buys  = txData.transactions.filter(tx => tx.type === 'achat').length
          const sells = txData.transactions.filter(tx => tx.type === 'vente').length
          if (mounted.current) { setTotalBuys(buys); setTotalSells(sells) }
        }

        // Config publique — chargée pour tous les utilisateurs connectés
        const { data: pubCfg } = await apiGetPublicConfig()
        if (pubCfg?.config && mounted.current) {
          const cfg = pubCfg.config
          setLimits(prev => ({
            ...prev,
            quizInterval:      cfg.quiz_interval       ?? prev.quizInterval,
            quizDuration:      cfg.quiz_duration       ?? prev.quizDuration,
            quizRarityRates:   cfg.quiz_rarity_rates   ?? prev.quizRarityRates,
            playerRanks:       cfg.player_ranks        ?? prev.playerRanks,
            marketSalesOpen:   cfg.market_sales_open   ?? prev.marketSalesOpen,
            maxActiveListings: cfg.max_active_listings ?? prev.maxActiveListings,
            botsVisible:       cfg.bots_visible        ?? prev.botsVisible,
          }))
        }

        // Config admin — uniquement pour les admins (limits_connected, limits_guest, etc.)
        if (profile.role === 'admin') {
          const { data: admCfg } = await apiGetAdminConfig()
          if (admCfg?.config && mounted.current) {
            const cfg = admCfg.config
            setLimits(prev => ({
              ...prev,
              connected: cfg.limits_connected ?? prev.connected,
              guest:     cfg.limits_guest     ?? prev.guest,
              marketExpireDays: cfg.market_expire_days ?? 30,
              registrationWhitelist: cfg.registration_whitelist ?? prev.registrationWhitelist ?? null,
            }))
          }
        }

        // Ping last_seen
        apiPingProfile()

      } catch (err) {
        if (import.meta.env.DEV) console.warn('[useGameState] load failed:', err.message)
      } finally {
        if (mounted.current) setLoadingData(false)
      }
    }

    loadAll()
  }, [profile?.id])

  // ── Recharger le marché périodiquement (toutes les 30s) ──────────────────
  const marketOpenRef = useRef(false)
  const refreshMarket = useCallback(async () => {
    if (!marketOpenRef.current) return   // ne rafraîchir que si le modal est ouvert
    const { data } = await apiGetMarket()
    if (!data?.market || !mounted.current) return
    const flat = []
    data.market.forEach(({ card, tiers }) => {
      tiers.forEach(tier => {
        tier.ids.forEach((id, i) => flat.push({ id, card, price: tier.price, seller: tier.sellers[i] || tier.sellers[0] }))
      })
    })
    setMarket(flat)
  }, [])

  useEffect(() => {
    if (!profile) return
    const interval = setInterval(refreshMarket, 30_000)
    return () => clearInterval(interval)
  }, [profile?.id, refreshMarket])

  // ── Derived ────────────────────────────────────────────────────────────────
  const isGuest     = !profile
  const lim         = limits[isGuest ? 'guest' : 'connected']
  const uniqueCards = useMemo(() => Object.keys(collection).filter(k => collection[k] > 0).length, [collection])
  const totalUnique = cardPool.length
  const myScore     = useMemo(() => collScore(collection, cardPool), [collection, cardPool])

  // ── Gold / Card limits (local, synced to API via profile) ─────────────────
  const earnGold = useCallback((n) => {
    const limit = lim?.dailyGold ?? 200
    const can = Math.min(n, limit - dailyGold)
    if (can <= 0) return 0
    setGold(g => g + can)
    setDailyGold(d => d + can)
    return can
  }, [lim, dailyGold])

  const earnCard = useCallback((card) => {
    const limit = lim?.dailyCards ?? 20
    if (dailyCards >= limit) return false
    setCollection(prev => ({ ...prev, [card.id]: (prev[card.id] || 0) + 1 }))
    setDailyCards(d => d + 1)
    return true
  }, [dailyCards, lim])

  // ── Achievements ──────────────────────────────────────────────────────────
  const checkAchievements = useCallback((overrides = {}) => {
    const s = { collection, cardPool, totalBuys, totalSells, dailyCards, streak, ...overrides }
    ACHIEVEMENT_DEF.forEach(def => {
      if (unlockedAchRef.current.has(def.id)) return  // verrou synchrone
      if (!def.check(s)) return
      unlockedAchRef.current.add(def.id)  // marquer immédiatement avant tout setState
      setUnlockedAch(prev => [...prev, def.id])
      setPendingAch(prev => [...prev, def])
      // Mise à jour optimiste de la collection + persistance DB
      setCollection(p => p[def.cardId] > 0 ? p : { ...p, [def.cardId]: 1 })
      if (def.cardId) apiGrantAchievement(def.cardId).catch(() => {})
    })
  }, [collection, cardPool, totalBuys, totalSells, dailyCards, streak])

  // ── Market actions ────────────────────────────────────────────────────────
  const handleBuy = useCallback(async (listing, index) => {
    // Optimistic update
    if (gold < listing.price) return 'insufficient'
    setGold(g => g - listing.price)
    setCollection(prev => ({ ...prev, [listing.card.id]: (prev[listing.card.id] || 0) + 1 }))
    setMarket(prev => prev.filter((_, i) => i !== index))

    // API call — obligatoire si connecté, rollback sinon
    if (profile) {
      if (!listing.id) {
        // Pas d'id DB → rollback immédiat, on ne peut pas persister
        setGold(g => g + listing.price)
        setCollection(prev => ({ ...prev, [listing.card.id]: Math.max(0, (prev[listing.card.id] || 0) - 1) }))
        setMarket(prev => [...prev, listing])
        return 'error_no_id'
      }
      const { data, error } = await apiBuyCard(listing.id)
      if (error) {
        setGold(g => g + listing.price)
        setCollection(prev => ({ ...prev, [listing.card.id]: Math.max(0, (prev[listing.card.id] || 0) - 1) }))
        setMarket(prev => [...prev, listing])
        return error
      }
    }

    // Rafraîchir le marché depuis l'API pour éviter les annonces fantômes
    if (profile) {
      apiGetMarket().then(({ data }) => {
        if (!data?.market) return
        const flat = []
        data.market.forEach(({ card, tiers }) => {
          tiers.forEach(tier => {
            tier.ids.forEach((id, i) => {
              flat.push({ id, card, price: tier.price, seller: tier.sellers[i] || tier.sellers[0] })
            })
          })
        })
        setMarket(flat)
      })

      // Si la carte achetée n'est pas dans cardPool (nouvelle carte), recharger le pool
      if (!cardPool.find(c => c.id === listing.card.id)) {
        apiGetCards().then(({ data }) => {
          if (data?.cards?.length && mounted.current) {
            setCardPool(data.cards)
          }
        })
      }
    }

    // Compteurs et historique — uniquement si l'achat a réellement eu lieu
    if (!profile || listing.id) {
      const newBuys = totalBuys + 1
      setTotalBuys(newBuys)
      const tx = {
        type: 'achat', cardName: listing.card.name, rarity: listing.card.rarity,
        counterpart: listing.seller, price: listing.price,
        date: new Date().toLocaleDateString('fr-FR'),
      }
      setTransactions(prev => [tx, ...prev])
      setTimeout(() => checkAchievements({ totalBuys: newBuys }), 50)
    }
    return 'ok'
  }, [gold, totalBuys, profile, checkAchievements])

  const handleListCard = useCallback(async (card, price, sellerName) => {
    setCollection(prev => ({ ...prev, [card.id]: Math.max(0, (prev[card.id] || 0) - 1) }))

    // Mise à jour optimiste pour un affichage instantané dans l'interface
    const tempId = `temp_${Date.now()}`
    const tempListing = { id: tempId, card, price, seller: sellerName }
    setMyListings(prev => [tempListing, ...prev]) // Ajout au début pour le voir directement
    setMarket(prev => [...prev, tempListing])

    if (profile) {
      // API call réel
      const { data, error } = await apiListCard(card.id, price)
      if (error) {
        // Rollback en cas d'erreur
        setCollection(prev => ({ ...prev, [card.id]: (prev[card.id] || 0) + 1 }))
        setMyListings(prev => prev.filter(l => l.id !== tempId))
        setMarket(prev => prev.filter(l => l.id !== tempId))
        return error
      }
      
      // Remplacer l'ID temporaire par l'ID réel généré par la base de données
      setMyListings(prev => prev.map(l => l.id === tempId ? { ...l, id: data.listing_id, seller: profile.pseudo } : l))
      setMarket(prev => prev.map(l => l.id === tempId ? { ...l, id: data.listing_id, seller: profile.pseudo } : l))

      // Rafraîchir depuis l'API pour avoir l'état cohérent
      apiGetMarket().then(({ data: mkt }) => {
        if (!mkt?.market) return
        const flat = []
        mkt.market.forEach(({ card: c, tiers }) => {
          tiers.forEach(tier => {
            tier.ids.forEach((id, i) => flat.push({ id, card: c, price: tier.price, seller: tier.sellers[i] || tier.sellers[0] }))
          })
        })
        setMarket(flat)
      })
      return null
    }

    return null
  }, [profile, checkAchievements])

  const handleCancelListing = useCallback(async (index, sellerName) => {
    const l = myListings[index]
    if (!l) return

    if (profile) {
      if (!l.id || String(l.id).startsWith('temp_')) return 'error_no_id'  // pas d'id → on ne peut pas persister, on ne modifie pas le state
      const { error } = await apiCancelListing(l.id)
      if (error) return error
    }

    setCollection(prev => ({ ...prev, [l.card.id]: (prev[l.card.id] || 0) + 1 }))
    setMyListings(prev => prev.filter(m => m.id !== l.id))
    setMarket(prev => { const idx = prev.findIndex(m => m.id === l.id || (m.card?.id === l.card?.id && m.price === l.price)); return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev })
  }, [myListings, profile])

  const handleCancelAllListings = useCallback(async () => {
    if (!profile) return

    const toCancel = myListings.filter(l => l.id && !String(l.id).startsWith('temp_'))
    if (toCancel.length === 0) return

    // Mise à jour optimiste instantanée
    setCollection(prev => {
      const next = { ...prev }
      toCancel.forEach(l => { next[l.card.id] = (next[l.card.id] || 0) + 1 })
      return next
    })
    setMyListings(prev => prev.filter(l => String(l.id).startsWith('temp_')))
    setMarket(prev => { const ids = new Set(toCancel.map(l => l.id)); return prev.filter(m => !ids.has(m.id)) })

    // Appels API en parallèle pour annuler
    await Promise.all(toCancel.map(l => apiCancelListing(l.id)))
  }, [myListings, profile])

  // ── Sale notification depuis WebSocket ────────────────────────────────────
  const handleSaleNotifFromSocket = useCallback(({ cardName, buyer, price, rarity }) => {
    setGold(g => g + price)
    setTotalSells(s => s + 1)
    setTransactions(prev => [{ type: 'vente', cardName, rarity: rarity || 'commun', counterpart: buyer, price, date: new Date().toLocaleDateString('fr-FR'), isNew: true }, ...prev])
    setSaleNotifs(prev => [...prev, { id: Date.now(), cardName, buyer, price }])
    setUnreadSales(n => n + 1)
  }, [])

  // ── Admin ─────────────────────────────────────────────────────────────────
  const adminAddCard = useCallback(async (card) => {
    if (profile) {
      const finalCard = { ...card };
      delete finalCard.thumbnailFile;

      const { data, error } = await apiAdminAddCard(finalCard)
      if (error) return error
      setCardPool(prev => [...prev, { ...data.card, sellable: data.card.sellable !== false, minPrice: data.card.min_price }])
    }
    return null
  }, [profile])

  const adminEditCard = useCallback(async (card) => {
    if (profile) {
      const finalCard = { ...card };
      delete finalCard.thumbnailFile;

      const { data, error } = await apiAdminEditCard(finalCard.id, finalCard)
      if (error) return error
      const updated = data?.card
        ? { ...data.card, desc: data.card.desc ?? data.card.description ?? '', image: data.card.image ?? data.card.image_url ?? null, thumbnail: data.card.thumbnail ?? data.card.image_url_thumb ?? null, minPrice: data.card.minPrice ?? data.card.min_price ?? null }
        : finalCard
      setCardPool(prev => prev.map(x => x.id === finalCard.id ? updated : x))
    }
    return null
  }, [profile])
  const adminDeleteCard = useCallback(async (cardId) => {
    // Retirer immédiatement du pool local
    setCardPool(prev => prev.filter(x => x.id !== cardId))
    if (profile) {
      const { error } = await apiAdminDeleteCard(cardId)
      if (error) {
        // Rollback si erreur
        const { data } = await apiGetCards()
        if (data?.cards?.length) setCardPool(data.cards.map(c => ({ ...c, desc: c.desc ?? c.description ?? '', image: c.image ?? c.image_url ?? null, minPrice: c.minPrice ?? c.min_price ?? null })))
        return error
      }
      // Re-fetch après un court délai pour que le cache soit invalidé
      setTimeout(async () => {
        const { data } = await apiGetCards()
        if (data?.cards) setCardPool(data.cards.map(c => ({ ...c, desc: c.desc ?? c.description ?? '', image: c.image ?? c.image_url ?? null, minPrice: c.minPrice ?? c.min_price ?? null })))
      }, 300)
    }
    return null
  }, [profile])

  const adminAddType = useCallback((type) => setCardTypes(prev => [...prev, type]), [])

  const adminDeleteType = useCallback(async (type) => {
    const fallback = cardTypes.find(t => t !== type) || 'Normal'
    if (profile) {
      const { data } = await apiAdminDeleteType(type)
      const fb = data?.fallbackType || fallback
      setCardPool(prev => prev.map(c => c.type === type ? { ...c, type: fb } : c))
      setCardTypes(prev => prev.filter(x => x !== type))
    }
  }, [cardTypes, profile])

  const adminRenameDefault = useCallback(async (name) => {
    const oldName = cardTypes[0]
    if (profile) {
      await apiAdminRenameType(oldName, name)
      setCardTypes(prev => [name, ...prev.slice(1)])
      setCardPool(prev => prev.map(c => c.type === oldName ? { ...c, type: name } : c))
    }
  }, [cardTypes, profile])
  const adminTogglePlayer  = useCallback((name) => setPlayers(prev => prev.map(p => p.name === name ? { ...p, status: p.status === 'banni' ? 'actif' : 'banni' } : p)), [])
  const adminBanIP         = useCallback((ip) => setBannedIPs(prev => [...prev, ip]), [])
  const adminUnbanIP       = useCallback((ip) => setBannedIPs(prev => prev.filter(i => i !== ip)), [])

  return {
    // World
    cardPool, setCardPool, cardTypes, market, setMarket, players, bannedIPs,
    limits, setLimits, maintenance, setMaintenance, loadingData,
    // Player
    gold, collection, setCollection, myListings, dailyGold, dailyCards, totalBuys, totalSells,
    streak, setStreak, transactions, setTransactions, unlockedAch, pendingAch, setPendingAch,
    saleNotifs, setSaleNotifs, unreadSales, setUnreadSales, clearNewTransactions, showBanner, setShowBanner, marketOpenRef,
    // Derived
    isGuest, lim, uniqueCards, totalUnique, myScore,
    // Actions
    earnGold, earnCard, checkAchievements,
    handleBuy, handleListCard, handleCancelListing, handleCancelAllListings,
    handleSaleNotifFromSocket,
    // Admin
    adminAddCard, adminEditCard, adminDeleteCard, adminAddType, adminDeleteType,
    adminRenameDefault, adminTogglePlayer, adminBanIP, adminUnbanIP,
  }
}
