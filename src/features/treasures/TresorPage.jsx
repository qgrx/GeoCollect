import { useState, useEffect } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { cardCC, rarityLabel, cardName, RC } from '../../data/cards.js'
import { getLang } from '../../i18n/translations.js'
import { ThumbImage } from '../quiz/QuizComponents.jsx'
import { PACK_PRICE_LABEL } from '../../data/constants.js'

export default function TresorPage({ dailyOffer, onClaim, onOpenShop }) {
  const { t } = useT()
  const { theme } = useTheme()
  const [claiming, setClaiming] = useState(false)
  const [localClaimed, setLocalClaimed] = useState(false)
  const [countdown, setCountdown] = useState('--:--:--')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0)
      const s = Math.max(0, Math.floor((midnight - now) / 1000))
      setCountdown(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleClaim = async () => {
    setClaiming(true)
    try { await onClaim(); setLocalClaimed(true) } finally { setClaiming(false) }
  }

  const card = dailyOffer?.card
  const claimed = dailyOffer?.claimed || localClaimed
  const { c1, c2 } = card ? cardCC(card.rarity) : { c1: '#f9ca24', c2: '#e17055' }
  const rc = card ? RC[card.rarity] : null

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Offre du jour ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🎁</span>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: theme.gold }}>{t('tresor_daily_title')}</div>
          <div style={{ marginLeft: 'auto', background: '#00b89420', border: '1px solid #00b89444', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 900, color: '#00b894' }}>{t('tresor_daily_free')}</div>
        </div>

        <div style={{ background: claimed ? theme.overlay : `linear-gradient(135deg,${c1}18,${c2}12)`, border: `1.5px solid ${claimed ? theme.border : c1 + '55'}`, borderRadius: 16, padding: '14px 16px', transition: 'all .4s' }}>
          {card ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `2px solid ${c1}`, background: '#1e3045', boxShadow: claimed ? 'none' : `0 0 14px ${c1}44` }}>
                {card.image_url
                  ? <ThumbImage src={card.image_url} alt={cardName(card, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{cardName(card, getLang())[0]}</div>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardName(card, getLang())}</div>
                <div style={{ fontSize: 11, color: rc?.color, fontWeight: 800, marginTop: 2 }}>{rarityLabel(card.rarity, t)}</div>
              </div>
              <button
                onClick={!claimed && !claiming ? handleClaim : undefined}
                style={{ background: claimed ? '#ffffff18' : `linear-gradient(135deg,${c1},${c2})`, border: 'none', color: claimed ? '#666' : '#1e3045', padding: '9px 15px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, cursor: claimed ? 'default' : 'pointer', flexShrink: 0, transition: 'all .3s', opacity: claiming ? 0.6 : 1 }}>
                {claimed ? t('tresor_daily_claimed') : claiming ? '…' : t('tresor_daily_claim')}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666', padding: '10px 0', fontSize: 13 }}>…</div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
          🕛 {t('tresor_daily_next')} <span style={{ fontWeight: 900, color: theme.textSecondary, fontFamily: 'monospace' }}>{countdown}</span>
        </div>
      </div>

      {/* ── Pack shop ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>💎</span>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: theme.gold }}>{t('tresor_shop_title')}</div>
        </div>

        <div style={{ background: 'linear-gradient(145deg,#1e1e3a,#2d1b4e)', borderRadius: 16, padding: '18px', border: '1.5px solid #f9ca2433', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: .05 }}>🎁</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 44, filter: 'drop-shadow(0 4px 12px #f9ca2466)' }}>🎁</div>
              <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 24, color: '#f9ca24', marginTop: 2 }}>{PACK_PRICE_LABEL}</div>
              <div style={{ fontSize: 10, color: '#888' }}>paiement unique</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', marginBottom: 7 }}>{t('shop_pack_title')}</div>
              {[
                { icon: '⚪', label: '6 cartes Communes',          note: null },
                { icon: '🔵', label: '2 cartes Rares garanties',   note: null },
                { icon: '🟣', label: '1 carte Épique ou Rare',     note: '(50/50)' },
                { icon: '🟠', label: '1 carte Légendaire ou Rare', note: '(20/80)' },
              ].map(({ icon, label, note }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 11 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: '#ddd', fontWeight: 700 }}>{label}</span>
                  {note && <span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>{note}</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#00b89412', border: '1px solid #00b89433', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
            💚 {t('shop_donation_note')}
          </div>

          <button
            onClick={onOpenShop}
            style={{ width: '100%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045', padding: '13px', borderRadius: 11, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px #f9ca2433', transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            💎 {t('tresor_shop_open')} — {PACK_PRICE_LABEL}
          </button>
          <div style={{ marginTop: 10, fontSize: 9, color: '#444', textAlign: 'center' }}>
            Paiement sécurisé via Stripe · Aucun abonnement · Aucune donnée bancaire stockée
          </div>
        </div>
      </div>
    </div>
  )
}
