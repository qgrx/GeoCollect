import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'
import { RC, cardCC } from '../../data/cards.js'
import Card from '../../components/Card.jsx'
import { TxHistoryModal } from '../achievements/NotifComponents.jsx'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'

export default function MarketModal({
  myCollection, market, onClose, onBuy, onListCard,
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
}) {
  const { t } = useT()
  const [tab, setTab] = useState(initialTab)
  const [sellCard, setSellCard] = useState(initialSellCard)
  const [sellPrice, setSellPrice] = useState(0)
  const [msg, setMsg] = useState('')
  const [exp, setExp] = useState(null)
  const [listPage, setListPage]           = useState(0)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [buySearch, setBuySearch]         = useState('')  // index en attente de confirmation
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

  const gArr = Object.values(ob).sort((a, b) => RC[a.card.rarity].order - RC[b.card.rarity].order)

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
    <div style={{ position: 'fixed',inset: 0,background: '#000c',display: 'flex',alignItems: 'center',justifyContent: 'center',zIndex: 700,backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)',borderRadius: 22,padding: 22,width: 'min(96vw,900px)',maxHeight: '90vh',overflowY: 'auto',boxShadow: '0 24px 80px #000a',border: '1.5px solid #ffffff18',fontFamily: "'Nunito',sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 14 }}>
          <div style={{ color: '#f9ca24',fontWeight: 900,fontSize: 20 }}>{t('market_title')}</div>
          <button onClick={onClose} style={{ background: '#ffffff22',border: 'none',color: '#fff',width: 32,height: 32,borderRadius: '50%',fontSize: 16,cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex',gap: 7,marginBottom: 18,flexWrap: 'wrap' }}>
          {tabs.map(tab_ => (
            <button key={tab_.id} onClick={() => { setTab(tab_.id); setMsg(''); setExp(null) }}
              style={{ position: 'relative', background: tab === tab_.id ? '#f9ca24' : '#ffffff22',border: 'none',color: tab === tab_.id ? '#1a1a2e' : '#fff',padding: '7px 15px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 12,cursor: 'pointer',whiteSpace: 'nowrap' }}>
              {tab_.label}
              {tab_.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#e74c3c', color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: '50%', padding: '2px 5px', border: `1.5px solid ${tab === tab_.id ? '#f9ca24' : '#1a1a2e'}`, animation: 'pulseBadge 1.5s infinite' }}>{tab_.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── ACHETER ── */}
        {tab === 'acheter' && (
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <input value={buySearch} onChange={e => setBuySearch(e.target.value)}
                placeholder="🔍 Rechercher une carte…"
                style={{ flex: 1, background: '#ffffff0f', border: '1px solid #ffffff18', borderRadius: 9, color: '#fff', padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, outline: 'none' }}/>
              {buySearch && <button onClick={() => setBuySearch('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>}
            </div>
            {(() => {
              const q = buySearch.trim().toLowerCase()
              const filtered = q ? gArr.filter(({ card }) => card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q)) : gArr
              return filtered.length === 0 ? (
              <div style={{ textAlign: 'center',color: '#888',padding: '30px 0' }}>
                <div style={{ fontSize: 36 }}>🏜️</div>
                <div style={{ marginTop: 8 }}>{t('market_empty')}</div>
              </div>
            ) : (
              <div style={{ display: 'flex',flexDirection: 'column',gap: 9 }}>
                {filtered.map(({ card, tiersArr, totalQty, maxQty }) => {
                  const isO = exp === card.id
                  const rc = RC[card.rarity]
                  const { c1, c2 } = cardCC(card.rarity)
                  const owned = (myCollection[card.id] || 0) > 0
                  return (
                    <div key={card.id} style={{ background: '#ffffff07',border: isO ? '1.5px solid #f9ca2455' : '1.5px solid #ffffff12',borderRadius: 13,overflow: 'hidden' }}>
                      <div onClick={() => setExp(isO ? null : card.id)} style={{ display: 'flex',alignItems: 'center',gap: 11,padding: '9px 13px',cursor: 'pointer' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{card.name[0]}</div>
                        <div style={{ flex: 1,minWidth: 0 }}>
                          <div style={{ display: 'flex',alignItems: 'center',gap: 7,flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 900,fontSize: 14,color: '#fff' }}>{card.name}</span>
                            <span style={{ background: rc.bg,color: rc.color,fontSize: 8,fontWeight: 800,padding: '1px 6px',borderRadius: 50,textTransform: 'uppercase' }}>{rc.label}</span>
                            {owned && <span style={{ background: '#f9ca2422',color: '#f9ca24',fontSize: 8,fontWeight: 800,padding: '1px 6px',borderRadius: 50 }}>{t('market_already_owned')}</span>}
                          </div>
                          <div style={{ fontSize: 10,color: '#aaa',marginTop: 2,display: 'flex',gap: 10,flexWrap: 'wrap' }}>
                            <span style={{ color: '#f9ca24',fontWeight: 800 }}>{totalQty.toLocaleString()} {t('market_for_sale')}</span>
                            <span>{tiersArr.length} {tiersArr.length > 1 ? t('market_tiers_pl') : t('market_tiers')}</span>
                            <span>{t('market_from')} <span style={{ color: '#00b894',fontWeight: 800 }}>{tiersArr[0].price}G</span></span>
                          </div>
                        </div>
                        <div style={{ color: isO ? '#f9ca24' : '#666',fontSize: 17,transform: isO ? 'rotate(180deg)' : 'none',flexShrink: 0,transition: 'transform .25s' }}>⌄</div>
                      </div>
                      {isO && (
                        <div style={{ borderTop: '1px solid #ffffff10',padding: '9px 13px 11px',display: 'flex',flexDirection: 'column',gap: 4 }}>
                          <div style={{ display: 'grid',gridTemplateColumns: '65px 1fr 50px auto',gap: 5,padding: '0 3px 4px',borderBottom: '1px solid #ffffff10',fontSize: 9,color: '#666',fontWeight: 700,textTransform: 'uppercase' }}>
                            <span>{t('market_price')}</span><span>{t('market_volume')}</span><span style={{ textAlign: 'right' }}>{t('market_qty')}</span><span style={{ textAlign: 'right' }}>{t('market_buy_btn')}</span>
                          </div>
                          {tiersArr.slice(0, 5).map((tier, i) => {
                            const bp = maxQty > 0 ? (tier.qty / maxQty * 100) : 0
                            const ca = gold >= tier.price
                            const ib = i === 0
                            const isOwn = myPseudo && tier.sellers.includes(myPseudo)
                            return (
                              <div key={tier.price} style={{ display: 'grid',gridTemplateColumns: '65px 1fr 50px auto',gap: 5,alignItems: 'center',padding: '4px 3px',borderRadius: 6,background: isOwn ? '#f9ca2408' : ib ? '#00b89412' : 'transparent',border: isOwn ? '1px solid #f9ca2428' : ib ? '1px solid #00b89428' : '1px solid transparent', opacity: ca ? 1 : 0.4 }}>
                                <div style={{ fontWeight: 900,fontSize: 13,color: isOwn ? '#f9ca24' : ib ? '#00b894' : '#f9ca24',display: 'flex',alignItems: 'center',gap: 3,flexWrap: 'wrap' }}>
                                  {isOwn && <span style={{ fontSize: 7,background: '#f9ca24',color: '#1a1a2e',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>Moi</span>}
                                  {!isOwn && ib && <span style={{ fontSize: 7,background: '#00b894',color: '#fff',borderRadius: 3,padding: '1px 4px',fontWeight: 800 }}>{t('market_best')}</span>}
                                  {tier.price}G
                                </div>
                                <div>
                                  <div style={{ background: '#ffffff12',borderRadius: 3,height: 5,overflow: 'hidden',marginBottom: 2 }}>
                                    <div style={{ width: `${bp}%`, height: '100%', background: ib ? 'linear-gradient(90deg,#00b894,#00cec9)' : `linear-gradient(90deg,${c1}88,${c2}88)`, borderRadius: 3, transition: 'width .4s' }} />
                                  </div>
                                  <div style={{ fontSize: 9,color: '#555',whiteSpace: 'nowrap',overflow: 'hidden',textOverflow: 'ellipsis' }}>
                                    {tier.sellers.slice(0, 3).map((s, si) => (
                                      <span key={si}>{si > 0 && ', '}
                                        <PseudoDisplay pseudo={s} score={topSellerScores[s] || 0} ranks={ranks} tag="span" style={{ fontSize: 9 }}/>
                                      </span>
                                    ))}{tier.qty > tier.sellers.length ? ` +${tier.qty - tier.sellers.length}` : ''}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right',fontWeight: 800,color: '#ccc',fontSize: 11 }}>{tier.qty.toLocaleString()}</div>
                                <div style={{ textAlign: 'right' }}>
                                  {isOwn ? (
                                    <span style={{ fontSize: 9,color: '#f9ca24',fontWeight: 700,opacity: .7 }}>Votre annonce</span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (owned && !window.confirm(t('market_duplicate_confirm').replace('{card}', card.name))) return
                                        // Utiliser le listing complet depuis market[] pour avoir l'id DB
                                        const fullListing = market[tier.indices[0]] || { seller: tier.sellers[0], card, price: tier.price }
                                        onBuy(fullListing, tier.indices[0])
                                      }}
                                      disabled={!ca}
                                    style={{ background: ca ? 'linear-gradient(135deg,#00b894,#00cec9)' : '#2a2a2a',border: 'none',color: ca ? '#fff' : '#555',padding: '5px 9px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 10,cursor: ca ? 'pointer' : 'not-allowed',whiteSpace: 'nowrap' }}>
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
              <div style={{ color: '#f9ca24',fontWeight: 800,marginBottom: 9,fontSize: 13 }}>{t('market_duplicates')}</div>
              {myCards.length === 0 ? (
                <div style={{ color: '#888',padding: '16px 0',textAlign: 'center',fontSize: 13 }}>
                  {t('market_no_duplicates')}<br />
                  <span style={{ fontSize: 11,color: '#555' }}>{t('market_no_duplicates_hint2')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex',flexWrap: 'wrap',gap: 7,maxHeight: 280,overflowY: 'auto' }}>
                  {myCards.map(({ card, cnt }) => (
                    <Card key={card.id} card={card} count={cnt} small selected={sellCard?.id === card.id}
                      onClick={() => { setSellCard(sellCard?.id === card.id ? null : card); setSellPrice(0); setMsg('') }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1,minWidth: 180 }}>
              {sellCard ? (
                <div style={{ background: '#ffffff0a',border: '1.5px solid #ffffff18',borderRadius: 15,padding: 18 }}>
                  <div style={{ color: '#f9ca24',fontWeight: 900,marginBottom: 11,fontSize: 14 }}>🏷️ Mettre en vente</div>
                  <div style={{ display: 'flex',justifyContent: 'center',marginBottom: 11 }}><Card card={sellCard} /></div>
                  {sellCard.minPrice && <div style={{ fontSize: 11,color: '#f39c12',marginBottom: 7 }}>⚠️ {t('market_min_price')} {sellCard.minPrice}G</div>}
                  <div style={{ display: 'flex',alignItems: 'center',gap: 8,marginBottom: 9 }}>
                    <span style={{ color: '#fff',fontWeight: 800 }}>💰</span>
                    <input type="number" min={sellCard.minPrice || 1} max={9999} value={sellPrice || ''} placeholder="0"
                      onChange={e => setSellPrice(+e.target.value)}
                      style={{ background: '#ffffff15',border: '1px solid #f9ca2466',color: '#f9ca24',padding: '7px 10px',borderRadius: 8,width: 80,fontFamily: "'Nunito',sans-serif",fontSize: 15,fontWeight: 900,outline: 'none' }} />
                    <span style={{ color: '#aaa' }}>G</span>
                  </div>
                  {(() => {
                    const lowestPrice = ob[sellCard.id]?.tiersArr?.[0]?.price;
                    if (!lowestPrice) return null;
                    const targetPrice = Math.max(sellCard.minPrice || 1, lowestPrice);
                    return (
                      <div style={{ marginBottom: 11 }}>
                        <button onClick={() => { setSellPrice(targetPrice); setMsg(''); }}
                          style={{ background: '#00b89415',border: '1px solid #00b89444',color: '#00b894',padding: '5px 12px',borderRadius: 50,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer' }}>
                          👇 Prix le plus bas actuel : {targetPrice}G
                        </button>
                      </div>
                    )
                  })()}
                  {msg && <div style={{ color: '#00b894',fontWeight: 800,marginBottom: 8,fontSize: 11 }}>{msg}</div>}
                  <button 
                    disabled={sellPrice <= 0 || (sellCard.minPrice && sellPrice < sellCard.minPrice)}
                    onClick={() => { onListCard(sellCard, sellPrice); setMsg(''); setSellCard(null); setSellPrice(0); setTab('meslistes'); }}
                    style={{ width: '100%',background: 'linear-gradient(135deg,#f9ca24,#e17055)',border: 'none',color: '#1a1a2e',padding: '11px',borderRadius: 10,fontFamily: "'Nunito',sans-serif",fontWeight: 900,fontSize: 14,cursor: (sellPrice <= 0 || (sellCard.minPrice && sellPrice < sellCard.minPrice)) ? 'not-allowed' : 'pointer',opacity: (sellPrice <= 0 || (sellCard.minPrice && sellPrice < sellCard.minPrice)) ? 0.5 : 1 }}>
                    {t('market_list_btn')}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#ffffff08',border: '1.5px dashed #ffffff22',borderRadius: 15,padding: 22,textAlign: 'center',color: '#666' }}>
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
                  <button onClick={() => setTab('vendre')} style={{ marginTop: 12, background: '#00b89415', border: '1px solid #00b89444', color: '#00b894', padding: '6px 14px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>+ Vendre une carte</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 12,flexWrap: 'wrap',gap: 8 }}>
                    <div style={{ display: 'flex',alignItems: 'center',gap: 12 }}>
                      <div style={{ fontSize: 12,color: '#888',fontWeight: 700 }}>
                        {myListings.length} annonce{myListings.length > 1 ? 's' : ''} en cours
                      </div>
                      <button onClick={() => setTab('vendre')} style={{ background: '#00b89415', border: '1px solid #00b89444', color: '#00b894', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>+ Vendre une autre carte</button>
                      {myListings.length > 1 && (
                        <button onClick={onCancelAllListings} style={{ background: '#e74c3c15', border: '1px solid #e74c3c44', color: '#e74c3c', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>✕ Tout retirer</button>
                      )}
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex',alignItems: 'center',gap: 6 }}>
                        <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={page === 0}
                          style={{ background: page===0?'#ffffff0a':'#ffffff18',border:'none',color:page===0?'#444':'#fff',width:28,height:28,borderRadius:8,cursor:page===0?'default':'pointer',fontWeight:900,fontSize:14 }}>‹</button>
                        <span style={{ fontSize: 11,color: '#888',fontWeight: 700 }}>{page + 1} / {totalPages}</span>
                        <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                          style={{ background: page===totalPages-1?'#ffffff0a':'#ffffff18',border:'none',color:page===totalPages-1?'#444':'#fff',width:28,height:28,borderRadius:8,cursor:page===totalPages-1?'default':'pointer',fontWeight:900,fontSize:14 }}>›</button>
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
                        <div key={l.id || realIdx} style={{ display: 'flex',alignItems: 'center',gap: 11,background: isConfirming ? '#e74c3c12' : (isTemp ? '#00b89415' : '#ffffff08'),border: `1px solid ${isConfirming ? '#e74c3c44' : (isTemp ? '#00b89466' : '#ffffff12')}`,borderRadius: 12,padding: '10px 14px',transition: 'all .3s ease', animation: isTemp ? 'highlightNewListing .4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both' : 'none' }}>
                          {/* Indicateur rareté */}
                          <div style={{ width: 38,height: 38,borderRadius: 10,background: `linear-gradient(135deg,${c1},${c2})`,display: 'flex',alignItems: 'center',justifyContent: 'center',fontSize: 12,fontWeight: 900,color: '#fff',flexShrink: 0 }}>
                            {l.card.name[0]}
                          </div>
                          {/* Infos */}
                          <div style={{ flex: 1,minWidth: 0 }}>
                            <div style={{ fontWeight: 900,color: '#fff',fontSize: 14,whiteSpace: 'nowrap',overflow: 'hidden',textOverflow: 'ellipsis' }}>{l.card.name}</div>
                            <div style={{ fontSize: 10,color: rc.color,fontWeight: 700,marginTop: 1 }}>{rc.label} · {l.card.type}</div>
                          </div>
                          {/* Prix */}
                          <div style={{ fontWeight: 900,fontSize: 17,color: '#f9ca24',flexShrink: 0 }}>{l.price}G</div>
                          {/* Actions */}
                          {isConfirming ? (
                            <div style={{ display: 'flex',gap: 6,flexShrink: 0 }}>
                              <button onClick={() => { onCancelListing(realIdx); setCancelConfirm(null); setListPage(p => Math.min(p, Math.max(0, Math.ceil((myListings.length - 1) / LIST_PAGE_SIZE) - 1))); }}
                                style={{ background: 'linear-gradient(135deg,#d63031,#e17055)',border: 'none',color: '#fff',padding: '5px 11px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 900,fontSize: 11,cursor: 'pointer' }}>
                                Confirmer
                              </button>
                              <button onClick={() => setCancelConfirm(null)}
                                style={{ background: '#ffffff18',border: 'none',color: '#aaa',padding: '5px 10px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer' }}>
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setCancelConfirm(realIdx)}
                              style={{ background: '#e74c3c22',border: '1px solid #e74c3c44',color: '#e74c3c',padding: '5px 12px',borderRadius: 8,fontFamily: "'Nunito',sans-serif",fontWeight: 800,fontSize: 11,cursor: 'pointer',flexShrink: 0 }}>
                              Retirer
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
          <TxHistoryModal transactions={transactions.slice(0, 50)} onClose={onClose} embedded />
        )}

      </div>
    </div>
  )
}
