import { useState, useRef, useCallback } from 'react'
import { RC, cardCC, rarityLabel, cardName } from '../data/cards.js'
import { useT } from '../i18n/translations.js'
import { ShinyEffect } from './Card.jsx'
import { ReferralPanel } from '../features/referral/ReferralModal.jsx'

export default function CardDetailModal({ card, count, owned, onClose, onSell, isShiny = false }) {
  const { t, lang } = useT()

  const imgRef = useRef()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const onMove = useCallback(e => {
    const el = imgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = (e.clientX - r.left) / r.width  - 0.5
    const cy = (e.clientY - r.top)  / r.height - 0.5
    setTilt({ x: cy * -18, y: cx * 18 })
  }, [])
  const onLeave = useCallback(() => setTilt({ x: 0, y: 0 }), [])

  if (!card) return null
  const rc = RC[card.rarity] || RC.commun
  const { c1, c2 } = cardCC(card.rarity)
  const isLeg = card.rarity === 'légendaire'
  const hasImage = !!(card.image || card.image_url)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000c',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1500, backdropFilter: 'blur(12px)', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: 'min(92vw,360px)', borderRadius: 24, maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto', overflowX: 'hidden',
          background: `linear-gradient(145deg,${c1}22,${c2}33,#0f0f1e)`,
          border: isShiny ? '2px solid #f9ca24' : `2px solid ${c1}88`,
          boxShadow: isShiny
            ? undefined
            : `0 0 60px ${c1}44, 0 32px 80px #000c`,
          animation: isShiny
            ? 'shinyBorder 2.4s linear infinite, cardPop .3s cubic-bezier(.34,1.56,.64,1) both'
            : 'cardPop .3s cubic-bezier(.34,1.56,.64,1) both',
          filter: (owned ?? count > 0) ? 'none' : 'grayscale(1)',
          fontFamily: "'Nunito',sans-serif",
        }}>
        <style>{`
          @keyframes cardPop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
          @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
          @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        `}</style>

        {/* Header — sticky pour que la croix reste visible au scroll (mobile) */}
        <div style={{ background: isShiny ? 'linear-gradient(90deg,#b8860b,#f9ca24,#e6a817)' : `linear-gradient(90deg,${c1},${c2})`, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 5, overflow: 'hidden' }}>
          {(isLeg || isShiny) && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(90deg,transparent 40%,#ffffff22 50%,transparent 60%)',
            backgroundSize: '400px 100%', animation: 'shimmer 2s linear infinite' }}/>}
          <div>
            <div style={{ fontWeight: 900, fontSize: 12, color: isShiny ? '#f9ca24' : '#fff', textTransform: 'uppercase', letterSpacing: 1, textShadow: isShiny ? '-1px -1px 0 #0009, 1px -1px 0 #0009, -1px 1px 0 #0009, 1px 1px 0 #0009' : 'none' }}>
              {card.type}{isShiny && ' ✨'}
            </div>
            <div style={{ fontSize: 10, color: isShiny ? '#f9ca2499' : '#ffffff88', fontWeight: 700 }}>{rarityLabel(card.rarity, t)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {count > 0 && <div style={{ background: '#00000044', color: '#fff', borderRadius: 50, padding: '3px 10px', fontSize: 11, fontWeight: 900 }}>×{count}</div>}
            <button onClick={onClose} style={{ background: '#00000033', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', fontSize: 14, cursor: 'pointer', fontWeight: 900 }}>✕</button>
          </div>
        </div>

        {/* Image */}
        <div ref={imgRef}
          onMouseMove={onMove} onMouseLeave={onLeave}
          style={{ height: hasImage ? 280 : 180, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'default', padding: '20px',
            perspective: '800px', overflow: 'hidden' }}>

          {/* Glow de fond */}
          {isLeg && !isShiny && <div style={{ position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center,${c1}33 0%,transparent 70%)`,
            animation: 'pulse 2s infinite', pointerEvents: 'none' }}/>}
          {isShiny && <div style={{ position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 40%, rgba(255,220,100,0.12) 0%, rgba(180,100,255,0.08) 50%, transparent 75%)',
            pointerEvents: 'none' }}/>}

          {/* Effets shiny */}
          {isShiny && <ShinyEffect size="large" />}

          {hasImage ? (
            <img
              src={card.image || card.image_url}
              alt={card.name}
              style={{
                maxWidth: '100%', maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 12,
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.04 : 1})`,
                transition: tilt.x || tilt.y ? 'transform .1s ease-out' : 'transform .4s ease',
                filter: isShiny
                  ? 'brightness(1.08) contrast(1.05) saturate(1.2)'
                  : isLeg
                  ? `drop-shadow(0 0 20px ${c1}88)`
                  : `drop-shadow(0 8px 16px #0008)`,
                animation: 'none',
                position: 'relative', zIndex: 2,
              }}
            />
          ) : (
            <div style={{ fontSize: 80, opacity: .25, userSelect: 'none' }}>🃏</div>
          )}
        </div>

        {/* Infos */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 24, color: isShiny ? '#f9ca24' : '#fff', marginBottom: 4, textShadow: isShiny ? '-1px -1px 0 #0009, 1px -1px 0 #0009, -1px 1px 0 #0009, 1px 1px 0 #0009, 0 0 12px #f9ca2455' : 'none' }}>
            {cardName(card, lang)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: rc.color, fontSize: 14 }}>{'★'.repeat(rc.stars)}{'☆'.repeat(4 - rc.stars)}</span>
            <span style={{ fontSize: 11, color: rc.color, fontWeight: 800, background: rc.bg, borderRadius: 50, padding: '2px 10px' }}>{rarityLabel(card.rarity, t)}</span>
            {isShiny && <span style={{ fontSize: 11, color: '#f9ca24', fontWeight: 900, background: '#f9ca2422', borderRadius: 50, padding: '2px 10px', border: '1px solid #f9ca2444' }}>✨ {t('shiny_label')}</span>}
          </div>
          {card.desc && (
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, fontStyle: 'italic',
              background: '#ffffff08', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              "{card.desc}"
            </div>
          )}
          {card.progressInfo && card.progressInfo.threshold > 0 && card.progressInfo.type !== 'referral' && (() => {
            const { progress, threshold } = card.progressInfo
            const pct = Math.min(100, Math.round((progress / threshold) * 100))
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 4 }}>
                  <span>Progression</span>
                  <span style={{ color: '#f9ca24' }}>{Math.min(progress, threshold)} / {threshold}</span>
                </div>
                <div style={{ background: '#ffffff14', borderRadius: 50, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: 'linear-gradient(90deg,#f9ca24,#e17055)', transition: 'width .5s' }}/>
                </div>
              </div>
            )
          })()}

          {/* Parrainage : lien partageable + progression des filleuls */}
          {card.progressInfo?.type === 'referral' && (
            <div style={{ marginBottom: 12 }}><ReferralPanel showTitle={false} /></div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ background: '#ffffff0a', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#888', fontWeight: 700 }}>
              Type : <span style={{ color: '#ccc' }}>{card.type}</span>
            </div>
            {card.sellable === false && <div style={{ background: '#e74c3c18', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>Non vendable</div>}
            {(card.minPrice || card.min_price) > 0 && <div style={{ background: '#f9ca2418', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#f9ca24', fontWeight: 700 }}>Min {card.minPrice || card.min_price}G</div>}
          </div>
        </div>

        {/* Action */}
        {onSell && count > 1 && card.sellable !== false && !isShiny && (
          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={onSell}
              style={{ width: '100%', background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)',
                border: 'none', color: '#fff', padding: '12px', borderRadius: 12,
                fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
              {t('sell_duplicate')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
