import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardCC, rarityLabel } from '../../data/cards.js'
import Card from '../../components/Card.jsx'
import { TxHistoryModal } from '../achievements/NotifComponents.jsx'
import { ThumbImage } from '../quiz/QuizComponents.jsx'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'
import { apiGetPriceCaps } from '../../services/api.js'

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
  const [listPage, setListPage]           = useState(0)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [buySearch, setBuySearch]         = useState('')  // index en attente de confirmation
  const [buySort, setBuySort]             = useState('rarity')
  const LIST_PAGE_SIZE = 6

  const myCards = Object.entries(myCollection)
    .filter(([, v]) => v > 1)
    .map(([id, cnt]) => ({ card: cardPool.find(c => c.id === +id), cnt }))
    .filter(x => x.card && x.card.sellable !== false)

  const ob = useMemo(() => {
    const g = {}
    market.forEach((l, i) => {
      const id = l.card.id
      if (!g[id]) g[id] = { card: l.card, tiers: {} }
      if (!g[id].tiers[l.price]) g[id].tiers[l.price] = { price: l.price, qty: 0, sellers: [], indices: [] }
      g[id].tiers[l.price].qty++
      if (g[id].tiers[l.price].sellers.length < 5) g[id].tiers[l.price].sellers.push(l.seller)
      g[id].tiers[l.price].indices.push(i)
    })
    Object.values(g).forEach(v => {
      v.tiersArr = Object.values(v.tiers).sort((a, b) => a.price - b.price)
      v.totalQty = v.tiersArr.reduce((s, t) => s + t.qty, 0)
      v.maxQty = Math.max(...v.tiersArr.map(t => t.qty))
    })
    return g
  }, [market])

  const gArr = useMemo(() => {
    const arr = Object.values(ob)
    switch (buySort) {
      case 'price_asc':
        return arr.sort((a, b) => a.tiersArr[0].price - b.tiersArr[0].price)
      case 'price_desc':
        return arr.sort((a, b) => b.tiersArr[0].price - a.tiersArr[0].price)
      case 'unowned':
        return arr.sort((a, b) => {
          const ao = (myCollection[a.card.id] || 0) > 0 ? 1 : 0
          const bo = (myCollection[b.card.id] || 0) > 0 ? 1 : 0
          if (ao !== bo) return ao - bo
          return RC[a.card.rarity].order - RC[b.card.rarity].order
        })
      default:
        return arr.sort((a, b) => RC[a.card.rarity].order - RC[b.card.rarity].order)
    }
  }, [ob, buySort, myCollection])

  const tabs = [
    { id: 'acheter',    label: t('market_buy') },
    { id: 'vendre',     label: t('market_sell') },
    { id: 'meslistes',  label: `${t('market_listings')}${myListings.length ? ` (${myListings.length})` : ''}` },
    { id: 'historique', label: t('market_history'), badge: unreadSales },
  ]

  const visitedHistoryRef = useRef(false)


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

  return (
    <PanelWrapper inline={inline} onClose={onClose} theme={theme}>
      <div style={{ padding: '18px 20px', flex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 14 }}>
          <div style={{ color: theme.gold,fontWeight: 900,fontSize: 20 }}>{t('market_title')}</div>
          {!inline && <button onClick={onClose} style={{ background: '#ffffff22',border: 'none',color: '#fff',width: 32,height: 32,borderRadius: '50%',fontSize: 16,cursor: 'pointer' }}>✕</button>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex',gap: 7,marginBottom: 18,flexWrap: 'wrap' }}>
          {tabs.map(tab_ => (
            <button key={tab_.id} onClick={() => { setTab(tab_.id); setMsg(''); setExp(null) }}
              style={{ position: 'relative', background: tab === tab_.id ? '#f9ca24' : theme.bgElevated, border: `1px solid ${tab === tab_.id ? '#f9ca24' : theme.border}`, color: tab === tab_.id ? '#1e3045' : theme.textPrimary, padding: '7px 15px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab_.label}
              {tab_.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#e74c3c', color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: '50%', padding: '2px 5px', border: `1.5px solid ${tab === tab_.id ? '#f9ca24' : '#1e3045'}`, animation: 'pulseBadge 1.5s infinite' }}>{tab_.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── ACHETER ── */}
        {tab === 'acheter' && (
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={buySearch} onChange={e => setBuySearch(e.target.value)}
                placeholder={t('collection_search')}
                style={{ flex: 1, minWidth: 120, background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 9, color: theme.textPrimary, padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, outline: 'none' }}/>
              {buySearch && <button onClick={() => setBuySearch('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>}
              <select value={buySort} onChange={e => setBuySort(e.target.value)}
                style={{ background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 9, color: theme.textPrimary, padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="rarity">{t('market_sort_label')}: {t('market_sort_rarity')}</option>
                <option value="price_asc">{t('market_sort_label')}: {t('market_sort_price_asc')}</option>
                <option value="price_desc">{t('market_sort_label')}: {t('market_sort_price_desc')}</option>
                <option value="unowned">{t('market_sort_label')}: {t('market_sort_unowned')}</option>
              </select>
            </div>
            {(() => {
              const q = buySearch.trim().toLowerCase()
              const filtered = q ? gArr.filter(({ card }) => card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q)) : gArr
              return filtered.length === 0 ? (
              loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0', gap: 10 }}>
                  <style>{`@keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-8px);opacity:1}}`}</style>
                  {[0, 0.18, 0.36].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />)}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                  <div style={{ fontSize: 36 }}>🏜️</div>
                  <div style={{ marginTop: 8 }}>{t('market_empty')}</div>
                </div>
              )
            ) : (
              <div style={{ display: 'flex',flexDirection: 'column',gap: 9 }}>
                {filtered.map(({ card, tiersArr, totalQty, maxQty }) => {
                  const isO = exp === card.id
                  const rc = RC[card.rarity]
                  const { c1, c2 } = cardCC(card.rarity)
                  const owned = (myCollection[card.id] || 0) > 0
                  return (
                    <div key={card.id} style={{ background: theme.overlay,border: isO ? `1.5px solid #f9ca2455` : `1.5px solid ${theme.border}`,borderRadius: 13,overflow: 'hidden' }}>
                      <div onClick={() => setExp(isO ? null : card.id)} style={{ display: 'flex',alignItems: 'center',gap: 11,padding: '9px 13px',cursor: 'pointer' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden', background: `linear-gradient(135deg,${c1},${c2})`, flexShrink: 0, border: `1.5px solid ${c1}66` }}>
                          {(card.image_url_thumb || card.image_url)
                            ? <ThumbImage src={card.image_url_thumb || card.image_url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{card.name[0]}</div>
                          }
                        </div>
                        <div style={{ flex: 1,minWidth: 0 }}>
                          <div style={{ display: 'flex',alignItems: 'center',gap: 7,flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 900,fontSize: 14,color: theme.textPrimary }}>{card.name}</span>
                            <span style={{ background: rc.bg,color: rc.color,fontSize: 8,fontWeight: 800,padding: '1px 6px',borderRadius: 50,textTransform: 'uppercase' }}>{rarityLabel(card.rarity, t)}</span>
                            {owned && <span style={{ background: '#f9ca2422',color: theme.gold,fontSize: 8,fontWeight: 800,padding: '1px 6px',borderRadius: 50 }}>{t('market_already_owned')}</span>}
                          </div>
                          <div style={{ fontSize: 10,color: theme.textMuted,marginTop: 2,display: 'flex',gap: 10,flexWrap: 'wrap' }}>
                            <span style={{ color: theme.gold,fontWeight: 800 }}>{totalQty.toLocaleString()} {t('market_for_sale')}</span>
                            <span>{tiersArr.length} {tiersArr.length > 1 ? t('market_tiers_pl') : t('market_tiers')}</span>
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
                            const isOwn = myPseudo && tier.sellers.includes(myPseudo)
                            return (
                              <div key={tier.price} style={{ display: 'grid',gridTemplateColumns: '65px 1fr 50px auto',gap: 5,alignItems: 'center',padding: '4px 3px',borderRadius: 6,background: isOwn ? '#f9ca2408' : ib ? '#00b89412' : 'transparent',border: isOwn ? '1px solid #f9ca2428' : ib ? '1px solid #00b89428' : '1px solid transparent', opacity: ca ? 1 : 0.4 }}>
                                <div style={{ fontWeight: 900,fontSize: 13,color: isOwn ? theme.gold : ib ? '#00b894' : theme.textPrimary,display: 'flex',alignItems: 'center',gap: 3,flexWrap: 'wrap' }}>
                                  {isOwn && <span style={{ fontSize: 7,background: '#f9ca24',color: '#1e3045',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>Moi</span>}
                                  {!isOwn && ib && <span style={{ fontSize: 7,background: '#00b894',color: '#fff',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>{t('market_best')}</span>}
                                  {tier.price}G
                                </div>
                                <div>
                                  <div style={{ background: theme.overlayMd,borderRadius: 3,height: 5,overflow: 'hidden',marginBottom: 2 }}>
                                    <div style={{ width: `${bp}%`, height: '100%', background: ib ? 'linear-gradient(90deg,#00b894,#00cec9)' : `linear-gradient(90deg,${c1}88,${c2}88)`, borderRadius: 3, transition: 'width .4s' }} />
                                  </div>
                                  <div style={{ fontSize: 9,color: theme.textMuted,whiteSpace: 'nowrap',overflow: 'hidden',textOverflow: 'ellipsis' }}>
                                    {tier.sellers.slice(0, 3).map((s, si) => (
                                      <span key={si}>{si > 0 && ', '}
                                        <PseudoDisplay pseudo={s} score={topSellerScores[s] || 0} ranks={ranks} tag="span" style={{ fontSize: 9 }}/>
                                      </span>
                                    ))}{tier.qty > tier.sellers.length ? ` +${tier.qty - tier.sellers.length}` : ''}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right',fontWeight: 800,color: theme.textSecondary,fontSize: 11 }}>{tier.qty.toLocaleString()}</div>
                                <div style={{ textAlign: 'right' }}>
                                  {isOwn ? (
                                    <span style={{ fontSize: 9,color: theme.gold,fontWeight: 700,opacity: .7 }}>Votre annonce</span>
                                  ) : (
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
            )})()}
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
                <div style={{ display: 'flex',flexWrap: 'wrap',columnGap: 7,rowGap: 12,padding: '4px' }}>
                  {myCards.map(({ card, cnt }) => (
                    <Card key={card.id} card={card} count={cnt} small selected={sellCard?.id === card.id}
                      onClick={() => { setSellCard(sellCard?.id === card.id ? null : card); setSellPrice(''); setMsg('') }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180, order: isMobile ? -1 : 0 }}>
              {sellCard ? (
                // top tient compte du header sticky de l'app (position: sticky, top: 0,
                // ~50-56px de haut) pour ne pas passer derriere lui une fois collé.
                <div style={{ position: isMobile ? 'static' : 'sticky', top: isMobile ? 0 : 64, marginTop: isMobile ? 24 : 24 }}>
                <div style={{ background: theme.overlay, border: `1.5px solid ${theme.border}`, borderRadius: 15, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Carte sélectionnée */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}><Card card={sellCard} /></div>

                  {/* Prix */}
                  {(() => {
                    const cap = priceCaps[sellCard.rarity]
                    const maxPrice = cap?.max != null ? Math.max(cap.max, sellCard.minPrice || 0) : null
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
                            setSellCard(null); setSellPrice(''); setTab('meslistes')
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

        {/* ── MES ANNONCES ── */}
        {tab === 'meslistes' && (() => {
          const totalPages = Math.ceil(myListings.length / LIST_PAGE_SIZE)
          const page = Math.min(listPage, Math.max(0, totalPages - 1))
          const slice = myListings.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE)
          return (
            <div>
              <style>{`
                @keyframes highlightNewListing {
                  0% { opacity: 0; transform: translateY(-10px); background: #00b89444; border-color: #00b894aa; }
                  100% { opacity: 1; transform: translateY(0); background: #00b89415; border-color: #00b89466; }
                }
              `}</style>
              {myListings.length === 0 ? (
                <div style={{ textAlign: 'center',color: '#888',padding: '36px 0' }}>
                  <div style={{ fontSize: 36 }}>📭</div>
                  <div style={{ marginTop: 8,fontSize: 13 }}>{t('market_no_listings')}</div>
                  <button onClick={() => setTab('vendre')} style={{ marginTop: 12, background: 'none', border: 'none', color: '#00b894', padding: '4px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>{t('market_sell_geocoin')}</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 12,flexWrap: 'wrap',gap: 8 }}>
                    <div style={{ display: 'flex',alignItems: 'center',gap: 12 }}>
                      <div style={{ fontSize: 12,color: '#888',fontWeight: 700 }}>
                        {(myListings.length > 1 ? t('market_listings_count_plural') : t('market_listings_count')).replace('{n}', myListings.length)}
                      </div>
                      <button onClick={() => setTab('vendre')} style={{ background: 'none', border: 'none', color: '#00b894', padding: '4px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}>{t('market_sell_geocoin')}</button>
                      {myListings.length > 1 && (
                        <button onClick={onCancelAllListings} style={{ background: '#e74c3c15', border: '1px solid #e74c3c44', color: '#e74c3c', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>✕ Tout retirer</button>
                      )}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex',alignItems: 'center',gap: 6 }}>
                        <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={page === 0}
                          style={{ background: page===0?theme.overlay:theme.bgElevated,border:`1px solid ${theme.border}`,color:page===0?theme.textMuted:theme.textPrimary,width:28,height:28,borderRadius:8,cursor:page===0?'default':'pointer',fontWeight:900,fontSize:14 }}>‹</button>
                        <span style={{ fontSize: 11,color: theme.textMuted,fontWeight: 700 }}>{page + 1} / {totalPages}</span>
                        <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                          style={{ background: page===totalPages-1?theme.overlay:theme.bgElevated,border:`1px solid ${theme.border}`,color:page===totalPages-1?theme.textMuted:theme.textPrimary,width:28,height:28,borderRadius:8,cursor:page===totalPages-1?'default':'pointer',fontWeight:900,fontSize:14 }}>›</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex',flexDirection: 'column',gap: 8 }}>
                    {slice.map((l, si) => {
                      const realIdx = page * LIST_PAGE_SIZE + si
                      const { c1, c2 } = cardCC(l.card.rarity)
                      const rc = RC[l.card.rarity]
                      const isConfirming = cancelConfirm === realIdx
                      const isTemp = String(l.id).startsWith('temp_')
                      return (
                        <div key={l.id || realIdx} style={{ display: 'flex',alignItems: 'center',gap: 11,background: isConfirming ? '#e74c3c12' : (isTemp ? '#00b89415' : theme.overlay),border: `1px solid ${isConfirming ? '#e74c3c44' : (isTemp ? '#00b89466' : theme.border)}`,borderRadius: 12,padding: '10px 14px',transition: 'all .3s ease', animation: isTemp ? 'highlightNewListing .4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both' : 'none' }}>
                          {/* Vignette geocoin */}
                          <div style={{ width: 38, height: 38, borderRadius: 10, overflow: 'hidden', background: `linear-gradient(135deg,${c1},${c2})`, flexShrink: 0, border: `1.5px solid ${c1}66` }}>
                            {(l.card.image_url_thumb || l.card.image_url)
                              ? <ThumbImage src={l.card.image_url_thumb || l.card.image_url} alt={l.card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{l.card.name[0]}</div>
                            }
                          </div>
                          {/* Infos */}
                          <div style={{ flex: 1,minWidth: 0 }}>
                            <div style={{ fontWeight: 900,color: theme.textPrimary,fontSize: 14,whiteSpace: 'nowrap',overflow: 'hidden',textOverflow: 'ellipsis' }}>{l.card.name}</div>
                            <div style={{ fontSize: 10,color: rc.color,fontWeight: 700,marginTop: 1 }}>{rarityLabel(l.card.rarity, t)} · {l.card.type}</div>
                          </div>
                          {/* Prix */}
                          <div style={{ fontWeight: 900,fontSize: 17,color: theme.gold,flexShrink: 0 }}>{l.price}G</div>
                          {/* Actions */}
                          {isConfirming ? (
                            <div style={{ display: 'flex',gap: 6,flexShrink: 0 }}>
                              <button onClick={() => { onCancelListing(realIdx); setCancelConfirm(null); setListPage(p => Math.min(p, Math.max(0, Math.ceil((myListings.length - 1) / LIST_PAGE_SIZE) - 1))); }}
                                style={{ background: 'linear-gradient(135deg,#d63031,#e17055)',border: 'none',color: '#fff',padding: '5px 11px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 900,fontSize: 11,cursor: 'pointer' }}>
                                Confirmer
                              </button>
                              <button onClick={() => setCancelConfirm(null)}
                                style={{ background: theme.bgElevated,border: `1px solid ${theme.border}`,color: theme.textMuted,padding: '5px 10px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer' }}>
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setCancelConfirm(realIdx)}
                              style={{ background: '#e74c3c22',border: '1px solid #e74c3c44',color: '#e74c3c',padding: '5px 12px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer',flexShrink: 0 }}>
                              {t('market_remove')}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display: 'flex',justifyContent: 'center',gap: 5,marginTop: 12 }}>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} onClick={() => setListPage(i)}
                          style={{ width: 8,height: 8,borderRadius: '50%',border: 'none',cursor: 'pointer',background: i === page ? '#f9ca24' : '#ffffff33',padding: 0,transition: 'background .2s' }}/>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* ── HISTORIQUE — 50 dernières ventes/achats ── */}
        {tab === 'historique' && (
          <TxHistoryModal transactions={transactions.slice(0, 50)} onClose={onClose} embedded cardPool={cardPool} />
        )}

      </div>
    </PanelWrapper>
  )
}
