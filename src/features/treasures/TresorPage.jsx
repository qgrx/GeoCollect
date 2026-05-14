import { useState, useEffect } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { cardCC, rarityLabel, cardName, RC } from '../../data/cards.js'
import { getLang } from '../../i18n/translations.js'
import { ThumbImage } from '../quiz/QuizComponents.jsx'

const PACK_DEFS = [
  {
    id:           'petit_soutien',
    emoji:        '🎁',
    gradient:     'linear-gradient(135deg,#0984e3,#74b9ff)',
    glowColor:    '#0984e344',
    borderColor:  '#74b9ff55',
    defaultName:  'Petit soutien',
    defaultPrice: '3,00 €',
    highlight:    false,
    contents: [
      { icon: '⚪', label: '2 Communs' },
      { icon: '🔵', label: '2 Rares' },
      { icon: '🟣', label: '1 Rare ou supérieure', note: '50% Épique' },
      { icon: '🪙', label: '50 Golds' },
    ],
  },
  {
    id:           'soutien',
    emoji:        '💎',
    gradient:     'linear-gradient(135deg,#6c5ce7,#a29bfe)',
    glowColor:    '#6c5ce755',
    borderColor:  '#a29bfe66',
    defaultName:  'Soutien',
    defaultPrice: '8,00 €',
    highlight:    true,
    badge:        '⭐ Populaire',
    contents: [
      { icon: '⚪', label: '6 Communs' },
      { icon: '🔵', label: '2 Rares garantis' },
      { icon: '🟣', label: '1 Rare ou supérieure', note: '50% Épique' },
      { icon: '🟠', label: '1 Épique ou supérieure', note: '50% Légendaire' },
      { icon: '🪙', label: '150 Golds' },
    ],
  },
  {
    id:           'gros_soutien',
    emoji:        '👑',
    gradient:     'linear-gradient(135deg,#e17055,#f9ca24)',
    glowColor:    '#f9ca2444',
    borderColor:  '#f9ca2466',
    defaultName:  'Gros soutien',
    defaultPrice: '15,00 €',
    highlight:    false,
    contents: [
      { icon: '⚪', label: '6 Communs' },
      { icon: '🔵', label: '2 Rares garantis' },
      { icon: '🟣', label: '1 Épique garantie' },
      { icon: '🟠', label: '1 Légendaire garantie' },
      { icon: '🪙', label: '300 Golds' },
    ],
  },
]

export default function TresorPage({ dailyOffer, onClaim, onOpenShop, shopPacksConfig = {} }) {
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

  const visiblePacks = PACK_DEFS.filter(p => shopPacksConfig[p.id]?.enabled !== false)

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Offre du jour ── */}
      <div style={{ marginBottom: 28 }}>
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

      {/* ── Packs ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>💎</span>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: theme.gold }}>{t('tresor_shop_title')}</div>
        </div>

        {/* Texte de soutien */}
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 16, padding: '10px 14px', background: '#00b89410', border: '1px solid #00b89430', borderRadius: 10 }}>
          💚 Cet achat permet de soutenir <strong style={{ color: '#00b894' }}>geocoins.fr</strong> dans son développement et ses frais d'hébergement.<br />
          <span style={{ color: theme.textMuted }}>Aucun abonnement, aucune obligation.</span>
        </div>

        {/* 3 cartes packs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {visiblePacks.map(p => {
            const cfg    = shopPacksConfig[p.id] || {}
            const name   = cfg.name  || p.defaultName
            const price  = cfg.price || p.defaultPrice

            return (
              <div key={p.id} onClick={onOpenShop} style={{
                background: 'linear-gradient(145deg,#1a1a2e,#16213e)',
                borderRadius: 16,
                border: p.highlight ? `2px solid ${p.borderColor}` : `1px solid ${p.borderColor}`,
                boxShadow: p.highlight ? `0 0 24px ${p.glowColor}, 0 4px 20px #0006` : `0 4px 14px #0004`,
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                transition: 'transform .15s, box-shadow .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 32px ${p.glowColor}, 0 8px 28px #0007` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = p.highlight ? `0 0 24px ${p.glowColor}, 0 4px 20px #0006` : `0 4px 14px #0004` }}>

                {/* Bandeau coloré haut */}
                <div style={{ height: 5, background: p.gradient }} />

                {p.badge && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: p.gradient, color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 20, boxShadow: '0 2px 8px #0004' }}>
                    {p.badge}
                  </div>
                )}

                <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Icône + prix */}
                  <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 70 }}>
                    <div style={{ fontSize: 38, filter: `drop-shadow(0 4px 10px ${p.glowColor})`, lineHeight: 1 }}>{p.emoji}</div>
                    <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 20, color: '#f9ca24', marginTop: 6, lineHeight: 1 }}>{price}</div>
                    <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>paiement unique</div>
                  </div>

                  {/* Nom + contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', marginBottom: 8 }}>{name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {p.contents.map(({ icon, label, note }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13 }}>{icon}</span>
                          <span style={{ fontSize: 12, color: '#ccc', fontWeight: 700 }}>{label}</span>
                          {note && <span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>({note})</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flèche */}
                  <div style={{ alignSelf: 'center', color: '#555', fontSize: 22, flexShrink: 0 }}>›</div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 9, color: '#444', textAlign: 'center' }}>
          🔒 Paiement sécurisé via Stripe · Aucune donnée bancaire stockée
        </div>
      </div>
    </div>
  )
}
