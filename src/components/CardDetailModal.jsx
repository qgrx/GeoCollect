import { useState, useRef, useCallback } from 'react'
import { RC, cardCC } from '../data/cards.js'

export default function CardDetailModal({ card, count, onClose, onSell }) {
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
        style={{ width: 'min(92vw,360px)', borderRadius: 24, overflow: 'hidden',
          background: `linear-gradient(145deg,${c1}22,${c2}33,#0f0f1e)`,
          border: `2px solid ${c1}88`,
          boxShadow: `0 0 60px ${c1}44, 0 32px 80px #000c`,
          fontFamily: "'Nunito',sans-serif",
          animation: 'cardPop .3s cubic-bezier(.34,1.56,.64,1) both' }}>
        <style>{`
          @keyframes cardPop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
          @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
          @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        `}</style>

        {/* Header */}
        <div style={{ background: `linear-gradient(90deg,${c1},${c2})`, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'relative', overflow: 'hidden' }}>
          {isLeg && <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg,transparent 40%,#ffffff22 50%,transparent 60%)',
            backgroundSize: '400px 100%', animation: 'shimmer 2s linear infinite' }}/>}
          <div>
            <div style={{ fontWeight: 900, fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>{card.type}</div>
            <div style={{ fontSize: 10, color: '#ffffff88', fontWeight: 700 }}>{rc.label}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {count > 0 && <div style={{ background: '#00000044', color: '#fff', borderRadius: 50, padding: '3px 10px', fontSize: 11, fontWeight: 900 }}>×{count}</div>}
            <button onClick={onClose} style={{ background: '#00000033', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', fontSize: 14, cursor: 'pointer', fontWeight: 900 }}>✕</button>
          </div>
        </div>

        {/* Image — élément principal, grand, avec effet 3D */}
        <div ref={imgRef}
          onMouseMove={onMove} onMouseLeave={onLeave}
          style={{ height: hasImage ? 260 : 180, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'default', padding: '16px',
            perspective: '800px' }}>
          {isLeg && <div style={{ position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center,${c1}33 0%,transparent 70%)`,
            animation: 'pulse 2s infinite', pointerEvents: 'none' }}/>}
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
                filter: isLeg ? `drop-shadow(0 0 20px ${c1}88)` : `drop-shadow(0 8px 16px #0008)`,
              }}
            />
          ) : (
            <div style={{ fontSize: 80, opacity: .25, userSelect: 'none' }}>🃏</div>
          )}
        </div>

        {/* Infos */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 24, color: '#fff', marginBottom: 4 }}>{card.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: rc.color, fontSize: 14 }}>{'★'.repeat(rc.stars)}{'☆'.repeat(4 - rc.stars)}</span>
            <span style={{ fontSize: 11, color: rc.color, fontWeight: 800, background: rc.bg, borderRadius: 50, padding: '2px 10px' }}>{rc.label}</span>
          </div>
          {card.desc && (
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, fontStyle: 'italic',
              background: '#ffffff08', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
              "{card.desc}"
            </div>
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
        {onSell && count > 1 && card.sellable !== false && (
          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={onSell}
              style={{ width: '100%', background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)',
                border: 'none', color: '#fff', padding: '12px', borderRadius: 12,
                fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
              🏷️ Vendre un doublon
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
