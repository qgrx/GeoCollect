import { useState, useEffect, useRef } from 'react'
import { cardCC } from '../../data/cards.js'
import { apiForgeCard } from '../../services/api.js'

// ─── Keyframes injectés une seule fois ───────────────────────────────────────
const STYLE = `
@keyframes forgeHeat {
  0%,100% { box-shadow: 0 0 20px #e17055aa, 0 0 60px #e1705544; }
  50%      { box-shadow: 0 0 40px #f9ca24cc, 0 0 100px #f9ca2466; }
}
@keyframes forgeScanline {
  0%   { top: 100%; opacity: .9; }
  100% { top: -10%;  opacity: 0;  }
}
@keyframes forgeColorReveal {
  0%   { filter: grayscale(1) brightness(.55) contrast(1.1); }
  30%  { filter: grayscale(.7) brightness(.7)  sepia(.4) hue-rotate(10deg); }
  60%  { filter: grayscale(.2) brightness(1.1) saturate(1.5); }
  100% { filter: grayscale(0) brightness(1)   saturate(1); }
}
@keyframes forgeBurst {
  0%   { transform: scale(.85); opacity: 0; }
  40%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes forgeParticle {
  0%   { transform: translateY(0) scale(1);   opacity: 1; }
  100% { transform: translateY(-80px) scale(0); opacity: 0; }
}
@keyframes forgeGlow {
  0%   { opacity: 0; transform: scale(.9); }
  50%  { opacity: 1; }
  100% { opacity: 0; transform: scale(1.5); }
}
`

function injectStyle() {
  if (document.getElementById('forge-styles')) return
  const s = document.createElement('style')
  s.id = 'forge-styles'
  s.textContent = STYLE
  document.head.appendChild(s)
}

// ─── Particules de forge ──────────────────────────────────────────────────────
function ForgeParticles({ active }) {
  if (!active) return null
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 10 + Math.random() * 80,
    delay: Math.random() * 0.6,
    size: 3 + Math.random() * 5,
    color: Math.random() > 0.5 ? '#f9ca24' : '#e17055',
  }))
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', bottom: '20%',
          left: `${p.left}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          animation: `forgeParticle ${0.8 + Math.random() * 0.6}s ${p.delay}s ease-out forwards`,
          boxShadow: `0 0 6px ${p.color}`,
        }}/>
      ))}
    </div>
  )
}

// ─── Carte en cours de forge (animation) ─────────────────────────────────────
function ForgingCard({ card, phase }) {
  const { c1, c2 } = cardCC(card.rarity)
  const isLeg = card.rarity === 'légendaire'
  const src = card.image || card.image_url

  const heating  = phase === 'heating'
  const reveal   = phase === 'reveal'
  const done     = phase === 'done'

  return (
    <div style={{ position: 'relative', width: 148, height: 190 }}>
      {/* Glow burst au reveal */}
      {(reveal || done) && (
        <div style={{
          position: 'absolute', inset: -30, borderRadius: 30,
          background: `radial-gradient(circle, ${c1}66 0%, transparent 70%)`,
          animation: 'forgeGlow .8s ease-out forwards',
          pointerEvents: 'none', zIndex: 0,
        }}/>
      )}

      {/* Carte principale */}
      <div style={{
        position: 'relative', width: 148, height: 190,
        borderRadius: 16, overflow: 'hidden',
        border: `2px solid ${done ? c1 : '#ffffff44'}`,
        animation: heating
          ? 'forgeHeat 0.6s ease-in-out infinite'
          : reveal
          ? 'forgeBurst 0.5s ease-out forwards'
          : 'none',
      }}>
        {/* Image avec filtre de révélation */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', paddingTop: 6,
          animation: reveal ? 'forgeColorReveal 1.2s ease-out forwards' : 'none',
          filter: done ? 'none' : heating ? 'grayscale(1) brightness(.55) contrast(1.1)' : 'none',
          background: src ? 'transparent' : `linear-gradient(145deg,${c1}44,${c2}66)`,
        }}>
          {src
            ? <img src={src} alt={card.name} style={{ width: '100%', height: '88%', objectFit: 'contain' }}/>
            : <div style={{ fontSize: 52, opacity: .22 }}>🃏</div>
          }
        </div>

        {/* Scanline de révélation */}
        {reveal && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, transparent, #fff, #f9ca24, #fff, transparent)',
            animation: 'forgeScanline 0.7s 0.1s ease-in forwards',
            pointerEvents: 'none', zIndex: 9,
          }}/>
        )}

        {/* Overlay métal pendant la chauffe */}
        {heating && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, #00000018 0px, #00000018 1px, transparent 1px, transparent 3px)',
            pointerEvents: 'none', zIndex: 8,
          }}/>
        )}

        {/* Nom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 11,
          background: `linear-gradient(to top, ${c1}ee 0%, ${c1}99 50%, transparent 100%)`,
          padding: '28px 8px 7px', textAlign: 'center',
        }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: '#fff',
            textShadow: '0 1px 4px #0008', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: "'Nunito',sans-serif" }}>
            {card.name}
          </div>
        </div>

        {/* Barre rareté */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 12,
          height: 4, background: `linear-gradient(90deg,${c1},${c2})` }}/>

        {/* Shimmer légendaire post-forge */}
        {done && isLeg && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 16, zIndex: 13,
            background: 'linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)',
            backgroundSize: '400px 100%', animation: 'shimmer 2.5s linear infinite', pointerEvents: 'none' }}/>
        )}

        <ForgeParticles active={reveal} />
      </div>
    </div>
  )
}

// ─── ForgeModal ───────────────────────────────────────────────────────────────
export default function ForgeModal({ cardPool, collection, forgePoints, onClose, onForged, inline = false }) {
  useEffect(() => { injectStyle() }, [])

  const [forgingId, setForgingId]   = useState(null) // card en cours de forge
  const [phase, setPhase]           = useState(null)  // heating | reveal | done
  const [error, setError]           = useState(null)
  const [recentlyForged, setRecentlyForged] = useState(new Set())
  const timerRef = useRef([])

  const forgeableCards = (cardPool || []).filter(c => c.forgeable)

  function clearTimers() { timerRef.current.forEach(clearTimeout); timerRef.current = [] }

  async function handleForge(card) {
    if (forgingId) return
    setError(null)
    setForgingId(card.id)
    setPhase('heating')

    // Phase 1 : chauffe (800ms)
    timerRef.current.push(setTimeout(async () => {
      setPhase('reveal')

      // Appel API pendant la révélation
      const { data, error: apiErr } = await apiForgeCard(card.id)

      timerRef.current.push(setTimeout(() => {
        if (apiErr) {
          setError(apiErr)
          setPhase(null)
          setForgingId(null)
          return
        }
        setPhase('done')
        setRecentlyForged(s => new Set(s).add(card.id))
        onForged?.(data)

        // Fermer l'overlay après un moment
        timerRef.current.push(setTimeout(() => {
          setForgingId(null)
          setPhase(null)
        }, 1400))
      }, 1000))
    }, 800))
  }

  useEffect(() => () => clearTimers(), [])

  const PanelWrapper = ({ children }) => inline ? (
    <div style={{ fontFamily: "'Nunito',sans-serif" }}>{children}</div>
  ) : (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', justifyContent: 'flex-end', fontFamily: "'Nunito',sans-serif" }}>
      <div onClick={() => { if (!forgingId) onClose() }} style={{ position: 'absolute', inset: 0, background: '#00000070', animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'relative', background: '#243447', width: 'min(100vw, 600px)', height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px #000c', borderLeft: '1px solid #344e68', animation: 'slideFromRight .25s cubic-bezier(.2,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )

  return (
    <PanelWrapper>

      {/* Overlay animation de forge (plein écran centré) */}
      {forgingId && (() => {
        const card = forgeableCards.find(c => c.id === forgingId)
        if (!card) return null
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 800,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24,
            background: '#000c',
          }}>
            <div style={{ fontSize: 13, color: '#a29bfe', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 2,
              animation: phase === 'heating' ? 'pulseBadge 0.6s infinite' : 'none',
            }}>
              {phase === 'heating' ? '🔥 Forge en cours…'
               : phase === 'reveal' ? '✨ Révélation…'
               : '🏆 Forgée !'}
            </div>
            <ForgingCard card={card} phase={phase} />
            {phase === 'done' && (
              <div style={{ color: '#00b894', fontWeight: 900, fontSize: 15,
                animation: 'forgeBurst .4s ease-out' }}>
                Carte ajoutée à ta collection !
              </div>
            )}
          </div>
        )
      })()}

      {/* Panneau principal */}
      <div style={{
        padding: 22,
        flex: 1,
        opacity: forgingId ? 0.15 : 1,
        transition: 'opacity .3s',
        pointerEvents: forgingId ? 'none' : 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 900, color: '#a29bfe', fontSize: 20 }}>🔨 Atelier de Forge</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
              Dépense tes points de forge pour acquérir des cartes exclusives
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Tes points</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: '#a29bfe' }}>🔨 {forgePoints}</div>
            </div>
            {!inline && <button onClick={onClose} style={{ background: '#ffffff18', border: 'none',
              color: '#fff', width: 32, height: 32, borderRadius: '50%',
              fontSize: 16, cursor: 'pointer' }}>✕</button>}
          </div>
        </div>

        {error && (
          <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c44',
            borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            color: '#e74c3c', fontSize: 12, fontWeight: 700 }}>
            ❌ {error}
          </div>
        )}

        {forgeableCards.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚒️</div>
            <div>Aucune carte forgeable disponible.</div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>
              L'admin peut en créer depuis le panneau Cartes.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {forgeableCards.map(card => {
              const { c1, c2 } = cardCC(card.rarity)
              const owned     = (collection[card.id] || 0) > 0
              const justDone  = recentlyForged.has(card.id)
              const canForge  = !owned && !justDone
              const canAfford = canForge && forgePoints >= (card.forge_cost || Infinity)
              const src = card.image || card.image_url

              return (
                <div key={card.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '12px 10px',
                  background: justDone ? '#00b89410' : '#ffffff06',
                  border: `1px solid ${justDone ? '#00b89444' : '#ffffff10'}`,
                  borderRadius: 16, width: 160,
                  transition: 'all .3s',
                }}>
                  {/* Carte */}
                  <div style={{
                    position: 'relative', width: 148, height: 190,
                    borderRadius: 16, overflow: 'hidden',
                    border: `1.5px solid ${canAfford ? c1 + '99' : '#ffffff18'}`,
                    boxShadow: canAfford && !owned ? `0 0 18px ${c1}44` : 'none',
                    filter: canAfford ? 'none' : 'grayscale(.6) brightness(.7)',
                    transition: 'filter .3s, box-shadow .3s',
                    background: src ? 'transparent' : `linear-gradient(145deg,${c1}44,${c2}66)`,
                  }}>
                    {src
                      ? <img src={src} alt={card.name} style={{ width: '100%', height: '88%', objectFit: 'contain', paddingTop: 6, display: 'block' }}/>
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '88%', fontSize: 48, opacity: .22 }}>🃏</div>
                    }
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: `linear-gradient(to top,${c1}ee,${c1}99 50%,transparent)`,
                      padding: '28px 8px 7px', textAlign: 'center',
                    }}>
                      <div style={{ fontWeight: 900, fontSize: 13, color: '#fff',
                        textShadow: '0 1px 4px #0008', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.name}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
                      background: `linear-gradient(90deg,${c1},${c2})` }}/>

                    {/* Badge possédé */}
                    {owned && (
                      <div style={{ position: 'absolute', top: 6, right: 6,
                        background: '#00b894cc', color: '#fff',
                        fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 6px' }}>
                        ✓ {collection[card.id]}×
                      </div>
                    )}
                  </div>

                  {/* Coût + bouton */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 14,
                      color: canAfford ? '#a29bfe' : '#444' }}>
                      🔨 {card.forge_cost ?? '?'}
                    </span>
                    <span style={{ fontSize: 10, color: '#555' }}>pts</span>
                  </div>

                  {owned ? (
                    <div style={{ width: '100%', padding: '8px 0', borderRadius: 10,
                      background: '#00b89418', border: '1px solid #00b89433',
                      textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#00b894' }}>
                      ✓ Déjà possédée
                    </div>
                  ) : (
                    <button
                      onClick={() => handleForge(card)}
                      disabled={!canAfford || !card.forge_cost}
                      style={{
                        width: '100%',
                        padding: '8px 0', borderRadius: 10,
                        border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed',
                        fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12,
                        background: canAfford
                          ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)'
                          : '#ffffff10',
                        color: canAfford ? '#fff' : '#444',
                        transition: 'all .2s',
                        boxShadow: canAfford ? '0 4px 14px #6c5ce744' : 'none',
                      }}
                      onMouseEnter={e => { if (canAfford) e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    >
                      {!card.forge_cost ? 'Coût non défini'
                        : canAfford ? '🔨 Forger'
                        : `Manque ${(card.forge_cost - forgePoints)} pts`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PanelWrapper>
  )
}
