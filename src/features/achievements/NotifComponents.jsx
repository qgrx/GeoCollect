import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardCC } from '../../data/cards.js'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'
import { ThumbImage } from '../quiz/QuizComponents.jsx'

// ─── Achievement Toast ────────────────────────────────────────────────────────
export function AchievementToast({ achievement, cardPool, onClose }) {
  const { t } = useT()
  const achCard = (cardPool || []).find(c => c.id === achievement.cardId)

  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 3500, width: 'min(96vw,420px)',
      background: 'linear-gradient(135deg,#1e3045,#1a4a7a)',
      border: '2px solid #f9ca2466', borderRadius: 18,
      boxShadow: '0 16px 60px #000b', fontFamily: "'Nunito',sans-serif",
      animation: 'slideUp .4s cubic-bezier(.34,1.56,.64,1) both', overflow: 'hidden',
    }}>
      <div style={{ background: 'linear-gradient(90deg,#f9ca24,#e17055)',padding: '7px 14px',display: 'flex',alignItems: 'center',gap: 8 }}>
        <span style={{ fontSize: 18 }}>{achievement.icon}</span>
        <span style={{ fontWeight: 900,fontSize: 13,color: '#1e3045' }}>{t('ach_unlocked')}</span>
        <button onClick={onClose} style={{ marginLeft: 'auto',background: 'none',border: 'none',color: '#1e3045',fontSize: 16,cursor: 'pointer',fontWeight: 900 }}>✕</button>
      </div>
      <div style={{ padding: '12px 16px',display: 'flex',gap: 14,alignItems: 'center' }}>
        <div style={{ fontSize: 36,flexShrink: 0 }}>{achievement.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900,color: '#fff',fontSize: 15,marginBottom: 2 }}>{achievement.label}</div>
          <div style={{ fontSize: 12,color: '#aaa',marginBottom: 8 }}>{achievement.desc}</div>
          {achCard && (
            <div style={{ fontSize: 11,color: '#f9ca24',fontWeight: 800 }}>
              {t('ach_card_reward')} {achCard.name}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sale Notification ────────────────────────────────────────────────────────
export function SaleNotif({ notif, onClose, ranks, buyerScore }) {
  const { t } = useT()
  const [progress, setProgress] = useState(100)
  const DURATION = 6000

  useEffect(() => {
    const timer = setTimeout(onClose, DURATION)
    const start = Date.now()
    const tick = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / DURATION) * 100)
      setProgress(pct)
      if (pct === 0) clearInterval(tick)
    }, 50)
    return () => { clearTimeout(timer); clearInterval(tick) }
  }, [])

  return (
    <div style={{ position: 'fixed', top: 70, right: 20, zIndex: 3500, width: 'min(96vw,330px)',
      background: 'linear-gradient(145deg,#0d2b1a,#0f3d1f)',
      border: '1.5px solid #00b89466', borderRadius: 16,
      boxShadow: '0 12px 40px #000b, 0 0 0 1px #00b89422',
      fontFamily: "'Nunito',sans-serif",
      animation: 'toastIn .4s cubic-bezier(.34,1.56,.64,1) both',
      overflow: 'hidden' }}>
      {/* Barre de progression */}
      <div style={{ height: 3, background: '#ffffff0a' }}>
        <div style={{ width: `${progress}%`, height: '100%',
          background: 'linear-gradient(90deg,#00b894,#55efc4)', transition: 'width .05s linear' }}/>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
        {/* Icône animée */}
        <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg,#00b894,#00cec9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          boxShadow: '0 4px 16px #00b89444', animation: 'coinBounce .6s cubic-bezier(.34,1.56,.64,1) both' }}>
          💰
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: '#00b894', fontSize: 12, textTransform: 'uppercase',
            letterSpacing: .8, marginBottom: 3 }}>
            {t('sale_title')} ✓
          </div>
          <div style={{ fontWeight: 900, color: '#fff', fontSize: 14, marginBottom: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {notif.cardName}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {t('sale_bought_by')} <PseudoDisplay pseudo={notif.buyer} score={buyerScore||0} ranks={ranks} style={{ color: '#ccc', fontWeight: 700 }}/>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#f9ca24',
            lineHeight: 1 }}>
            +{notif.price}G
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444',
            fontSize: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", marginTop: 2 }}>
            fermer
          </button>
        </div>
      </div>
      <style>{`@keyframes coinBounce{from{transform:scale(0) rotate(-20deg)}to{transform:scale(1) rotate(0)}}`}</style>
    </div>
  )
}

// ─── Transaction History Modal ────────────────────────────────────────────────
export function TxHistoryModal({ transactions = [], onClose, embedded = false, onRead, cardPool = [], saleTax = 0.12 }) {
  const { t } = useT()
  const { theme } = useTheme()
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  // Marquer tout comme lu à l'ouverture
  useEffect(() => { onRead?.() }, [])

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE)
  const pageItems = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const netOf = price => Math.floor(price * (1 - saleTax))

  const totalSpent  = transactions.filter(tx => tx.type === 'achat').reduce((s, tx) => s + tx.price, 0)
  const totalEarned = transactions.filter(tx => tx.type === 'vente').reduce((s, tx) => s + netOf(tx.price), 0)

  const content = (
    <>
      {!embedded && (
        <div style={{ display: 'flex',justifyContent: 'space-between',alignItems: 'center',marginBottom: 16 }}>
          <div style={{ color: theme.gold,fontWeight: 900,fontSize: 20 }}>{t('tx_title')}</div>
          <button onClick={onClose} style={{ background: theme.bgElevated,border: `1px solid ${theme.border}`,color: theme.textPrimary,width: 32,height: 32,borderRadius: '50%',fontSize: 16,cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Stats compactes */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 12, color: theme.textMuted }}>
        <span>🟢 <strong style={{ color: '#00b894' }}>+{totalEarned}G</strong> {t('tx_total_sells')}</span>
        <span style={{ color: theme.border }}>|</span>
        <span>🔴 <strong style={{ color: '#e74c3c' }}>-{totalSpent}G</strong> {t('tx_total_buys')}</span>
      </div>

      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', color: theme.textMuted, padding: '36px 0' }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <div style={{ marginTop: 8 }}>{t('tx_empty')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex',flexDirection: 'column',gap: 7 }}>
          {pageItems.map((tx, i) => {
            const isAchat = tx.type === 'achat'
            const { c1, c2 } = cardCC(tx.rarity || 'commun')
            return (
              <div key={i} onClick={() => tx.isNew && onRead && onRead(i)}
                style={{ display: 'flex',alignItems: 'center',gap: 10,
                  background: tx.isNew ? '#00b89412' : theme.overlay,
                  border: `1px solid ${tx.isNew ? '#00b89444' : theme.border}`,
                  borderRadius: 11,padding: '10px 14px',flexWrap: 'wrap',
                  cursor: tx.isNew ? 'pointer' : 'default' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: `linear-gradient(135deg,${c1},${c2})`, flexShrink: 0, border: `1.5px solid ${c1}66` }}>
                  {(() => {
                    const src = tx.cards?.image_url_thumb || tx.cards?.image_url
                      || cardPool.find(x => x.id == tx.card_id)?.image_url_thumb
                      || cardPool.find(x => x.id == tx.card_id)?.image_url
                    return src
                      ? <ThumbImage src={src} alt={tx.cardName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{tx.cardName?.[0]}</div>
                  })()}
                </div>
                <div style={{ flex: 1,minWidth: 120 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800,color: theme.textPrimary,fontSize: 13 }}>{tx.cardName}</span>
                    {tx.isNew && <span style={{ display: 'inline-block', fontSize: 9, background: '#e74c3c', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 900, animation: 'pulseBadge 1.5s infinite' }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 10,color: theme.textMuted,marginTop: 2 }}>
                    {isAchat ? t('tx_bought_from') : t('tx_sold_to')} {tx.counterpart} · {tx.date}
                  </div>
                </div>
                <div style={{ display: 'flex',alignItems: 'center',gap: 10,flexShrink: 0 }}>
                  <span style={{ width: 60, textAlign: 'center', boxSizing: 'border-box', fontSize: 11, background: isAchat ? '#e74c3c22' : '#00b89422', color: isAchat ? '#e74c3c' : '#00b894', border: `1px solid ${isAchat ? '#e74c3c44' : '#00b89444'}`, borderRadius: 50, padding: '3px 0', fontWeight: 800 }}>
                    {isAchat ? t('tx_buy_label') : t('tx_sell_label')}
                  </span>
                  <div style={{ display: 'flex',flexDirection: 'column',alignItems: 'flex-end',width: 84 }}>
                    <span style={{ fontWeight: 900,fontSize: 15,color: isAchat ? '#e74c3c' : theme.gold }}>
                      {isAchat ? '-' : '+'}{isAchat ? tx.price : netOf(tx.price)}G
                    </span>
                    {!isAchat && (
                      <span style={{ fontSize: 9,color: theme.textMuted }}>{tx.price}G {t('tx_fee_deducted')}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: page === 0 ? theme.overlay : theme.bgElevated, border: `1px solid ${theme.border}`, color: page === 0 ? theme.textMuted : theme.textPrimary, width: 30, height: 30, borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer', fontWeight: 900, fontSize: 14 }}>‹</button>
          <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700 }}>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            style={{ background: page === totalPages - 1 ? theme.overlay : theme.bgElevated, border: `1px solid ${theme.border}`, color: page === totalPages - 1 ? theme.textMuted : theme.textPrimary, width: 30, height: 30, borderRadius: 8, cursor: page === totalPages - 1 ? 'default' : 'pointer', fontWeight: 900, fontSize: 14 }}>›</button>
        </div>
      )}

    </>
  )

  if (embedded) return <div style={{ fontFamily: "'Nunito',sans-serif" }}>{content}</div>

  return (
    <div style={{ position: 'fixed',inset: 0,background: '#000c',display: 'flex',alignItems: 'center',justifyContent: 'center',zIndex: 700,backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e3045,#1a2d42)',borderRadius: 22,padding: 22,width: 'min(96vw,680px)',maxHeight: '88vh',overflowY: 'auto',boxShadow: '0 24px 80px #000a',border: '1.5px solid #ffffff18',fontFamily: "'Nunito',sans-serif" }}>
        {content}
      </div>
    </div>
  )
}
