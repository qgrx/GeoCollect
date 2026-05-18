import { useState, useEffect, useRef } from 'react'
import { cardCC } from '../../data/cards.js'
import { apiForgeCard, apiForgeShiny } from '../../services/api.js'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'
import Card from '../../components/Card.jsx'

// ─── Keyframes injectés une seule fois ───────────────────────────────────────
const STYLE = `
@keyframes starAppear {
  0%   { opacity: 0; transform: scale(0) rotate(-20deg); }
  60%  { opacity: 1; transform: scale(1.35) rotate(8deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@keyframes starTwinkle {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: .35; transform: scale(.7) rotate(15deg); }
}
@keyframes cardToShiny {
  0%   { filter: none; }
  18%  { filter: brightness(4) saturate(0); }
  55%  { filter: brightness(1.8) saturate(2.5); }
  100% { filter: brightness(1.1) saturate(1.3); }
}
@keyframes shinyCardGlow {
  0%,100% { box-shadow: 0 0 18px #f9ca2466; }
  50%     { box-shadow: 0 0 40px #f9ca24cc, 0 0 80px #ffffff22; }
}
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
@keyframes dotBounce {
  0%,100% { transform: translateY(0); opacity: .4; }
  50%     { transform: translateY(-8px); opacity: 1; }
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

// Étoiles positionnées autour de la carte (148×190), apparition progressive
const STAR_DEFS = [
  { x: -28, y: 10,  fs: 16, d: 0.00 },
  { x: 155, y: 20,  fs: 12, d: 0.18 },
  { x: 60,  y: -28, fs: 14, d: 0.36 },
  { x: -22, y: 155, fs: 10, d: 0.54 },
  // — reveal phase (≥0.8 s) —
  { x: 158, y: 130, fs: 18, d: 0.84 },
  { x: 30,  y: 200, fs: 12, d: 1.00 },
  { x: -26, y: 75,  fs: 10, d: 1.16 },
  { x: 120, y: -24, fs: 14, d: 1.32 },
  { x: 158, y: 175, fs: 10, d: 1.48 },
  { x: -24, y: 110, fs: 16, d: 1.64 },
  { x: 90,  y: 205, fs: 12, d: 1.80 },
  { x: 135, y: 200, fs: 10, d: 1.96 },
  { x: -20, y: 40,  fs: 14, d: 2.12 },
  { x: 155, y: 65,  fs: 12, d: 2.28 },
]

// ─── Étoiles progressives ─────────────────────────────────────────────────────
function ShinyStars() {
  return (
    <div style={{ position: 'absolute', inset: -30, pointerEvents: 'none', zIndex: 20 }}>
      {STAR_DEFS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.x + 30, top: s.y + 30,
          fontSize: s.fs, lineHeight: 1,
          animation: `starAppear .4s ${s.d}s both, starTwinkle 1.6s ${s.d + .4}s ease-in-out infinite`,
        }}>✨</div>
      ))}
    </div>
  )
}

// ─── Carte en cours de brillance ─────────────────────────────────────────────
function ShinyCard({ card, phase }) {
  const { c1, c2 } = cardCC(card.rarity)
  const src  = card.image || card.image_url
  const done = phase === 'done'
  return (
    <div style={{ position: 'relative', width: 148, height: 190 }}>
      <ShinyStars />
      <div style={{
        position: 'relative', width: 148, height: 190, borderRadius: 16, overflow: 'hidden',
        border: `2px solid ${done ? '#f9ca24' : '#ffffff33'}`,
        animation: phase === 'reveal'
          ? 'cardToShiny 1.2s ease-out forwards'
          : done ? 'shinyCardGlow 2s ease-in-out infinite' : 'none',
        transition: 'border-color .4s',
      }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', paddingTop: 6,
          background: src ? 'transparent' : `linear-gradient(145deg,${c1}44,${c2}66)`,
        }}>
          {src
            ? <img src={src} alt={card.name} style={{ width: '100%', height: '88%', objectFit: 'contain' }}/>
            : <div style={{ fontSize: 52, opacity: .22 }}>✨</div>
          }
        </div>
        {done && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, zIndex: 13,
            background: 'linear-gradient(135deg,transparent 35%,#ffffff33 50%,transparent 65%)',
            backgroundSize: '300px 100%', animation: 'shimmer 1.8s linear infinite', pointerEvents: 'none',
          }}/>
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 11,
          background: `linear-gradient(to top,${done ? '#f9ca24' : c1}ee 0%,${done ? '#f9ca24' : c1}99 50%,transparent 100%)`,
          padding: '28px 8px 7px', textAlign: 'center',
        }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: done ? '#1e3045' : '#fff',
            textShadow: done ? '0 1px 4px #f9ca2488' : '0 1px 4px #0008',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: "'Nunito',sans-serif" }}>
            {done ? '✨ ' : ''}{card.name}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 12,
          height: 4, background: done ? 'linear-gradient(90deg,#f9ca24,#fff,#f9ca24)' : `linear-gradient(90deg,${c1},${c2})` }}/>
      </div>
    </div>
  )
}

// ─── ForgeModal ───────────────────────────────────────────────────────────────
export default function ForgeModal({ cardPool, collection, shinyCollection = {}, forgePoints, onClose, onForged, inline = false, shinyForgeCostByRarity = {}, loading = false }) {
  useEffect(() => { injectStyle() }, [])
  const { theme } = useTheme()
  const { t } = useT()

  const [forgingId, setForgingId]   = useState(null) // card en cours de forge
  const [phase, setPhase]           = useState(null)  // heating | reveal | done
  const [shinyMode, setShinyMode]   = useState(false) // true = animation brillance
  const [error, setError]           = useState(null)
  const [recentlyForged, setRecentlyForged] = useState(new Set())
  const [activeTab, setActiveTab]   = useState('normal')
  const [shinyPage, setShinyPage]   = useState(0)
  const timerRef = useRef([])

  const SHINY_PAGE_SIZE = 12

  const forgeableCards = (cardPool || []).filter(c => c.forgeable)
  const ownedCards = (cardPool || []).filter(c => (collection[c.id] || 0) > 0 && c.type !== 'Achievement')

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

  async function handleForgeShiny(card) {
    if (forgingId) return
    setError(null)
    setShinyMode(true)
    setForgingId(card.id)
    setPhase('heating')

    timerRef.current.push(setTimeout(async () => {
      setPhase('reveal')
      const { data, error: apiErr } = await apiForgeShiny(card.id)

      timerRef.current.push(setTimeout(() => {
        if (apiErr) {
          setError(apiErr)
          setPhase(null)
          setForgingId(null)
          setShinyMode(false)
          return
        }
        setPhase('done')
        onForged?.(data)

        timerRef.current.push(setTimeout(() => {
          setForgingId(null)
          setPhase(null)
          setShinyMode(false)
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
      <div style={{ position: 'relative', background: theme.bgSurface, width: 'min(100vw, 600px)', height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px #000c', borderLeft: `1px solid ${theme.border}`, animation: 'slideFromRight .25s cubic-bezier(.2,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )

  return (
    <PanelWrapper>

      {/* Overlay animation de forge / brillance */}
      {forgingId && phase && (() => {
        const card = forgeableCards.find(c => c.id === forgingId) || ownedCards.find(c => c.id === forgingId)
        if (!card) return null
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1500,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24,
            background: shinyMode ? '#00000099' : '#000c',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2,
              color: shinyMode ? '#f9ca24' : '#a29bfe',
              animation: phase === 'heating' ? 'pulseBadge 0.6s infinite' : 'none',
            }}>
              {shinyMode
                ? phase === 'heating' ? t('forge_anim_shiny_heating')
                  : phase === 'reveal' ? t('forge_anim_shiny_reveal')
                  : t('forge_anim_shiny_done')
                : phase === 'heating' ? t('forge_anim_heating')
                  : phase === 'reveal' ? t('forge_anim_reveal')
                  : t('forge_anim_done')}
            </div>
            {shinyMode
              ? <ShinyCard card={card} phase={phase} />
              : <ForgingCard card={card} phase={phase} />}
            {phase === 'done' && (
              <div style={{ fontWeight: 900, fontSize: 15, animation: 'forgeBurst .4s ease-out',
                color: shinyMode ? '#f9ca24' : '#00b894' }}>
                {shinyMode ? t('forge_anim_shiny_result') : t('forge_anim_result')}
              </div>
            )}
          </div>
        )
      })()}

      {/* Panneau principal */}
      <div style={{
        padding: '18px 14px',
        flex: 1,
        opacity: forgingId ? 0.15 : 1,
        transition: 'opacity .3s',
        pointerEvents: forgingId ? 'none' : 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 900, color: '#a29bfe', fontSize: 20 }}>🔨 {t('forge_title')}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {t('forge_subtitle')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{t('forge_your_points')}</div>
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

        {/* Onglets Forger / Brillance */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { id: 'normal',    label: t('forge_tab_normal') || 'Forger' },
            { id: 'brillance', label: t('forge_tab_shiny')  || '✨ Brillance' },
          ].map(tb => (
            <button key={tb.id} onClick={() => setActiveTab(tb.id)} style={{
              background: activeTab === tb.id ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : theme.bgElevated,
              border: `1px solid ${activeTab === tb.id ? '#6c5ce7' : theme.border}`,
              color: activeTab === tb.id ? '#fff' : theme.textPrimary,
              padding: '7px 16px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer',
            }}>{tb.label}</button>
          ))}
        </div>

        {/* Tab Normal */}
        {activeTab === 'normal' && forgeableCards.length > 0 && (
          <div style={{ background: '#a29bfe18', border: '1px solid #a29bfe33', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#a29bfe', lineHeight: 1.6 }}>
            🗺️ {t('forge_archived_desc')}
          </div>
        )}
        {activeTab === 'normal' && (forgeableCards.length === 0 ? (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', gap: 10 }}>
              {[0, 0.18, 0.36].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: theme.textMuted, padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚒️</div>
              <div>{t('forge_no_cards')}</div>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: 14 }}>
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
                  width: 148,
                  transition: 'all .3s',
                }}>
                  {/* Carte */}
                  <div style={{
                    position: 'relative', width: 148, height: 190,
                    borderRadius: 16, overflow: 'hidden',
                    border: `1.5px solid ${owned ? c1 : c1 + '44'}`,
                    boxShadow: owned ? `0 0 18px ${c1}44` : 'none',
                    filter: owned ? 'none' : 'grayscale(1)',
                    opacity: owned ? 1 : 0.35,
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
                      color: canAfford ? '#a29bfe' : theme.textMuted }}>
                      🔨 {card.forge_cost ?? '?'}
                    </span>
                    <span style={{ fontSize: 10, color: theme.textMuted }}>pts</span>
                  </div>

                  {owned ? (
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#00b894', textAlign: 'center' }}>
                      ✓ {t('forge_already_forged')}
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
                          : theme.overlay,
                        color: canAfford ? '#fff' : theme.textMuted,
                        transition: 'all .2s',
                        boxShadow: canAfford ? '0 4px 14px #6c5ce744' : 'none',
                      }}
                      onMouseEnter={e => { if (canAfford) e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    >
                      {!card.forge_cost ? t('forge_undefined_cost')
                        : canAfford ? t('forge_btn')
                        : t('forge_missing_pts').replace('{n}', card.forge_cost - forgePoints)}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Tab Brillance */}
        {activeTab === 'brillance' && (() => {
          const totalPages = Math.ceil(ownedCards.length / SHINY_PAGE_SIZE)
          const page = Math.min(shinyPage, Math.max(0, totalPages - 1))
          const pageCards = ownedCards.slice(page * SHINY_PAGE_SIZE, (page + 1) * SHINY_PAGE_SIZE)
          return (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: 14 }}>
                {ownedCards.length === 0 ? (
                  loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', gap: 10, width: '100%' }}>
                      {[0, 0.18, 0.36].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />)}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: theme.textMuted, padding: '40px 0', width: '100%' }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
                      <div>{t('forge_no_shiny_cards')}</div>
                    </div>
                  )
                ) : pageCards.map(card => {
                  const alreadyShiny = (shinyCollection[card.id] || 0) > 0
                  const cost = card.shiny_forge_cost ?? shinyForgeCostByRarity[card.rarity] ?? null
                  const canAfford = cost != null && forgePoints >= cost
                  return (
                    <div key={card.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 148, opacity: alreadyShiny ? 0.5 : 1 }}>
                      <Card card={card} isShiny={alreadyShiny} />
                      <div style={{ fontSize: 11, color: cost == null ? '#e74c3c' : canAfford ? '#a29bfe' : theme.textMuted, fontWeight: 800 }}>🔨 {cost ?? '—'} pts</div>
                      {alreadyShiny ? (
                        <div style={{ fontSize: 11, color: '#00b894', fontWeight: 800 }}>{t('forge_shiny_already') || '✨ Déjà brillant'}</div>
                      ) : (
                        <button onClick={() => handleForgeShiny(card)} disabled={!canAfford}
                          style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: 'none',
                            background: canAfford ? 'linear-gradient(135deg,#f9ca24,#e17055)' : theme.overlay,
                            color: canAfford ? '#1e3045' : theme.textMuted,
                            fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12,
                            cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                          {canAfford
                            ? (t('forge_shiny_btn') || '✨ Rendre brillant')
                            : t('forge_missing_pts').replace('{n}', cost - forgePoints)}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 }}>
                  <button onClick={() => setShinyPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ background: page === 0 ? theme.overlay : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: page === 0 ? theme.textMuted : '#fff', padding: '6px 16px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: page === 0 ? 'default' : 'pointer' }}>
                    ←
                  </button>
                  <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700 }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setShinyPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                    style={{ background: page === totalPages - 1 ? theme.overlay : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: page === totalPages - 1 ? theme.textMuted : '#fff', padding: '6px 16px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: page === totalPages - 1 ? 'default' : 'pointer' }}>
                    →
                  </button>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </PanelWrapper>
  )
}
