import { useState, useEffect } from 'react'
import { useT } from '../../i18n/translations.js'
import { cardCC, rarityLabel, cardName, RC } from '../../data/cards.js'
import { getLang } from '../../i18n/translations.js'
import { apiGetJeuQuotidien } from '../../services/api.js'

function useMidnightCountdown() {
  const [display, setDisplay] = useState('--:--:--')
  useEffect(() => {
    const tick = () => {
      const now      = new Date()
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0)
      const s        = Math.max(0, Math.floor((midnight - now) / 1000))
      setDisplay(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:` +
        `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:` +
        `${String(s % 60).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return display
}

function formatNumero(str) {
  // Formater un grand entier (string) avec séparateurs de milliers
  try { return BigInt(str).toLocaleString(getLang() === 'fr' ? 'fr-FR' : 'en-US') }
  catch { return str }
}

export default function JeuQuotidien() {
  const { t }          = useT()
  const countdown      = useMidnightCountdown()
  const [data, setData] = useState(null)   // { geocoin, date, total_cards } | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGetJeuQuotidien()
      .then(({ data: d }) => setData(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const geocoin = data?.geocoin
  const card    = geocoin?.card
  const { c1, c2 } = card ? cardCC(card.rarity) : { c1: '#f9ca24', c2: '#e17055' }
  const rc      = card ? RC[card.rarity] : null

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes jeuPulse { 0%,100%{box-shadow:0 0 0 0 ${c1}44} 50%{box-shadow:0 0 0 8px ${c1}00} }
        @keyframes jeuFadeUp{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes shinyJeu  { 0%,100%{filter:hue-rotate(0deg) brightness(1)} 50%{filter:hue-rotate(30deg) brightness(1.15)} }
      `}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🪙</span>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: '#f9ca24' }}>
          {t('jeu_title')}
        </div>
        {geocoin && (
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#aaa',
            background: '#ffffff0f', border: '1px solid #ffffff14', borderRadius: 20, padding: '2px 10px' }}>
            {t('jeu_ordre').replace('{n}', geocoin.ordre)}
          </div>
        )}
      </div>

      {/* Carte principale */}
      <div style={{
        background:    card ? `linear-gradient(135deg,${c1}18,${c2}0d)` : '#ffffff08',
        border:        `1.5px solid ${card ? c1 + '44' : '#ffffff14'}`,
        borderRadius:  18,
        padding:       '18px 16px',
        animation:     'jeuFadeUp .4s ease-out both',
      }}>
        {loading ? (
          // Skeleton
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#ffffff0a',
              backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: '55%', borderRadius: 6, background: '#ffffff0a',
                backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite', marginBottom: 8 }} />
              <div style={{ height: 10, width: '35%', borderRadius: 6, background: '#ffffff07',
                backgroundSize: '400px 100%', animation: 'shimmer 1.4s .1s infinite' }} />
            </div>
          </div>
        ) : !geocoin ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#666', fontSize: 13 }}>
            {t('jeu_not_ready')}
          </div>
        ) : (
          <>
            {/* Image + infos carte */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${c1}`, background: '#1e3045',
                boxShadow: `0 0 18px ${c1}55`,
                animation: 'jeuPulse 3s ease-in-out infinite',
              }}>
                {card.image_url
                  ? <img src={card.image_url} alt={cardName(card, getLang())}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff',
                      background: `linear-gradient(135deg,${c1},${c2})` }}>
                      {cardName(card, getLang())[0]}
                    </div>
                }
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 17, color: '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cardName(card, getLang())}
                </div>
                <div style={{ fontSize: 11, color: rc?.color, fontWeight: 800, marginTop: 3 }}>
                  {rarityLabel(card.rarity, t)}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{card.type}</div>
              </div>
            </div>

            {/* Numéro */}
            <div style={{
              background:   `linear-gradient(135deg,${c1}22,${c2}18)`,
              border:       `1px solid ${c1}44`,
              borderRadius: 12,
              padding:      '12px 16px',
              textAlign:    'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#aaa', textTransform: 'uppercase',
                letterSpacing: 1.5, marginBottom: 4 }}>
                {t('jeu_numero')}
              </div>
              <div style={{
                fontFamily:  "'Fredoka One',sans-serif",
                fontSize:    clamp(geocoin.numero.length),
                color:       c1,
                textShadow:  `0 0 20px ${c1}88`,
                letterSpacing: 2,
                lineHeight:  1.1,
              }}>
                {formatNumero(geocoin.numero)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Compte à rebours */}
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 8 }}>
        {t('jeu_next')} <span style={{ fontWeight: 900, color: '#888', fontFamily: 'monospace' }}>{countdown}</span>
      </div>
    </div>
  )
}

// Adapter la taille de police selon la longueur du numéro formaté
function clamp(len) {
  if (len <= 10) return 28
  if (len <= 13) return 24
  return 20
}
