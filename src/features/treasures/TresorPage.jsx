import { useState, useEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { cardCC, rarityLabel, cardName, RC } from '../../data/cards.js'
import { getLang } from '../../i18n/translations.js'
import { ThumbImage } from '../quiz/QuizComponents.jsx'
import { slotsToContents, drawPackFromConfig } from '../../utils/gameUtils.js'
import { apiCreateCheckout, apiGetPurchase } from '../../services/api.js'

const DEFAULT_SLOTS = {
  petit_soutien: [
    { rarity: 'commun', qty: 2 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique', alt: 'rare', chance: 50 },
  ],
  soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique',     alt: 'rare',   chance: 50 },
    { rarity: 'légendaire', alt: 'épique', chance: 50 },
  ],
  gros_soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique' },
    { rarity: 'légendaire' },
  ],
}

const PACK_DEFS = [
  { id: 'petit_soutien', emoji: '🎁', gradient: 'linear-gradient(135deg,#0984e3,#74b9ff)', glowColor: '#0984e344', borderColor: '#74b9ff55', defaultName: 'Petit soutien',  defaultPrice: '3,00 €',  defaultGold: 50,  highlight: false },
  { id: 'soutien',       emoji: '💎', gradient: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', glowColor: '#6c5ce755', borderColor: '#a29bfe66', defaultName: 'Soutien',        defaultPrice: '8,00 €',  defaultGold: 150, highlight: true,  badge: '⭐ Populaire' },
  { id: 'gros_soutien',  emoji: '👑', gradient: 'linear-gradient(135deg,#e17055,#f9ca24)', glowColor: '#f9ca2444', borderColor: '#f9ca2466', defaultName: 'Gros soutien',   defaultPrice: '15,00 €', defaultGold: 300, highlight: false },
]

export default function TresorPage({ dailyOffer, onClaim, onReveal, cardPool = [], shopPacksConfig = {}, packsLoading = false }) {
  const { t } = useT()
  const { theme } = useTheme()
  const [claiming, setClaiming]       = useState(false)
  const [localClaimed, setLocalClaimed] = useState(false)
  const [countdown, setCountdown]     = useState('--:--:--')
  const [checkoutPack, setCheckoutPack] = useState(null)   // packId en cours de paiement
  const [checkoutError, setCheckoutError] = useState('')
  const pollRef = useRef(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

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

  async function handleCheckout(pack) {
    if (checkoutPack) return
    setCheckoutPack(pack.id)
    setCheckoutError('')

    const { data, error } = await apiCreateCheckout(pack.id)
    if (error || !data) {
      setCheckoutError(error || 'Erreur de paiement')
      setCheckoutPack(null)
      return
    }

    setCheckoutPack(null)
    console.log('[Shop] pay_url:', data.pay_url, 'debug:', data._debug)

    window.open(data.pay_url, '_blank', 'noopener')
    pollForPaid(data.checkout_id, pack)
  }

  function pollForPaid(checkoutId, pack) {
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      const { data } = await apiGetPurchase(checkoutId)
      if (data?.status === 'paid') {
        clearInterval(pollRef.current)
        const cards = drawPackFromConfig(cardPool, pack.slots)
        onReveal(cards, pack.gold)
      } else if (data?.status === 'failed' || data?.status === 'expired' || attempts > 10) {
        clearInterval(pollRef.current)
        setCheckoutError('Paiement échoué ou expiré.')
      }
    }, 2000)
  }

  const card = dailyOffer?.card
  const claimed = dailyOffer?.claimed || localClaimed
  const { c1, c2 } = card ? cardCC(card.rarity) : { c1: '#f9ca24', c2: '#e17055' }
  const rc = card ? RC[card.rarity] : null

  const visiblePacks = PACK_DEFS
    .map(p => {
      const cfg   = shopPacksConfig[p.id] || {}
      const slots = cfg.slots || DEFAULT_SLOTS[p.id]
      const gold  = cfg.gold  ?? p.defaultGold
      return {
        ...p,
        name:     cfg.name  || p.defaultName,
        price:    cfg.price || p.defaultPrice,
        contents: [
          ...slotsToContents(slots),
          ...(gold > 0 ? [{ icon: '🪙', label: `${gold} Golds` }] : []),
        ],
      }
    })

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

        {/* 3 cartes packs — skeleton tant que les prix ne sont pas chargés */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {packsLoading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ background: '#1a1a2e', borderRadius: 16, overflow: 'hidden', border: '1px solid #ffffff12' }}>
                <div style={{ height: 5, background: 'linear-gradient(90deg,#ffffff0a,#ffffff18,#ffffff0a)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
                <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(90deg,#ffffff08,#ffffff14,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, width: '40%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff08,#ffffff14,#ffffff08)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', marginBottom: 8 }} />
                    <div style={{ height: 10, width: '70%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0f,#ffffff05)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
                  </div>
                </div>
              </div>
            ))
          ) : visiblePacks.map(p => (
            <div key={p.id} style={{
              background: 'linear-gradient(145deg,#1a1a2e,#16213e)',
              borderRadius: 16,
              border: p.highlight ? `2px solid ${p.borderColor}` : `1px solid ${p.borderColor}`,
              boxShadow: p.highlight ? `0 0 24px ${p.glowColor}, 0 4px 20px #0006` : `0 4px 14px #0004`,
              overflow: 'hidden',
              position: 'relative',
            }}>
              {/* Bandeau coloré haut */}
              <div style={{ height: 5, background: p.gradient }} />

              {p.badge && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: p.gradient, color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 20, boxShadow: '0 2px 8px #0004' }}>
                  {p.badge}
                </div>
              )}

              <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Icône + prix */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 64 }}>
                  <div style={{ fontSize: 34, filter: `drop-shadow(0 4px 10px ${p.glowColor})`, lineHeight: 1 }}>{p.emoji}</div>
                  <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: '#f9ca24', marginTop: 5, lineHeight: 1 }}>{p.price}</div>
                  <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>unique</div>
                </div>

                {/* Nom + contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', marginBottom: 6 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                    {p.contents.map(({ icon, label, note }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11 }}>{icon}</span>
                        <span style={{ fontSize: 11, color: '#bbb', fontWeight: 700 }}>{label}</span>
                        {note && <span style={{ fontSize: 9, color: '#666', fontStyle: 'italic' }}>({note})</span>}
                      </div>
                    ))}
                  </div>
                  {/* Bouton SumUp */}
                  {checkoutError && checkoutPack === null && (
                    <div style={{ fontSize: 10, color: '#e74c3c', marginBottom: 4 }}>{checkoutError}</div>
                  )}
                  <button onClick={() => handleCheckout(p)} disabled={!!checkoutPack}
                    style={{ background: checkoutPack === p.id ? '#ffffff22' : p.gradient, border: 'none', color: checkoutPack === p.id ? '#aaa' : '#fff', padding: '8px 14px', borderRadius: 9, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12, cursor: checkoutPack ? 'not-allowed' : 'pointer', boxShadow: checkoutPack === p.id ? 'none' : `0 3px 12px ${p.glowColor}`, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .3s' }}>
                    {checkoutPack === p.id ? <><span>⏳</span> Connexion à SumUp…</> : <><span>💳</span> Payer avec SumUp</>}
                  </button>
                </div>
              </div>
            </div>
          ))
          }
        </div>

        <div style={{ fontSize: 9, color: '#444', textAlign: 'center' }}>
          🔒 Paiement sécurisé via SumUp · CB, Apple Pay, Google Pay · Aucune donnée bancaire stockée
        </div>
      </div>
    </div>
  )
}
