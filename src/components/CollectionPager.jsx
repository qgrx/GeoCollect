import { useState, useRef, useEffect } from 'react'

// ── Carrousel de pages de la collection ──────────────────────────────────────
// Navigation fluide entre les pages de geocoins : glissement droite→gauche
// (page suivante entre par la droite), swipe tactile sur mobile, flèches
// clavier sur desktop, légère profondeur 3D pendant le geste et balayage
// lumineux à l'arrivée sur la page.
//
// Le composant ne connaît pas le contenu : il reçoit renderPage(pageIndex) et
// pré-monte les pages adjacentes pour qu'elles soient visibles pendant le
// glissement (aperçu en bord d'écran dès que le doigt bouge).

const PAGER_CSS = `
@keyframes collSweep    { 0%{transform:translateX(280%) skewX(-16deg);opacity:0} 12%{opacity:1} 100%{transform:translateX(-140%) skewX(-16deg);opacity:0} }
@keyframes collHint     { 0%,100%{transform:translateX(6px);opacity:.55} 50%{transform:translateX(-8px);opacity:1} }
@keyframes collHintFade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
`
function injectPagerStyle() {
  if (document.getElementById('coll-pager-styles')) return
  const s = document.createElement('style')
  s.id = 'coll-pager-styles'
  s.textContent = PAGER_CSS
  document.head.appendChild(s)
}
injectPagerStyle()

const HINT_KEY = 'coll_swipe_hint_seen'
const COMMIT_MS = 430

export default function CollectionPager({ page, totalPages, count, onPageChange, renderPage, theme, isMobile, hintText, keysEnabled = true }) {
  const viewportRef = useRef(null)
  const ptr         = useRef(null)   // geste en cours : { id, x, y, active }
  const committing  = useRef(false)
  const justDragged = useRef(false)  // avale le click parasite juste après un swipe
  const [drag,     setDrag]     = useState(0)      // px suivant le doigt
  const [dragging, setDragging] = useState(false)
  const [commit,   setCommit]   = useState(0)      // -1 | 0 | +1 : transition engagée vers page+commit
  const [settle,   setSettle]   = useState(false)  // retour élastique (swipe insuffisant)
  const [sweep,    setSweep]    = useState(0)      // rejoue le balayage lumineux (clé)
  const [hintSeen, setHintSeen] = useState(() => { try { return !!localStorage.getItem(HINT_KEY) } catch { return true } })

  const markHintSeen = () => {
    setHintSeen(true)
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* private mode */ }
  }

  // Engage la transition vers la page adjacente : le rail glisse (droite→gauche
  // pour « suivant »), puis la page cible devient la page courante — le pane,
  // conservé par sa clé React, ne se remonte pas : aucun saut visuel.
  const doCommit = (dir) => {
    const target = page + dir
    if (committing.current || target < 0 || target >= totalPages) return
    committing.current = true
    setDrag(0); setDragging(false); setCommit(dir)
    if (!hintSeen) markHintSeen()
    try { navigator.vibrate?.(8) } catch { /* non supporté */ }
    setTimeout(() => {
      committing.current = false
      setCommit(0)
      setSweep(s => s + 1)
      onPageChange(target)
    }, COMMIT_MS)
  }

  // Saut direct (points de pagination) : pas de glissement multi-pages, juste
  // le changement + balayage lumineux.
  const doJump = (target) => {
    if (committing.current || target === page) return
    if (Math.abs(target - page) === 1) { doCommit(target - page); return }
    setSweep(s => s + 1)
    onPageChange(target)
  }

  // ── Swipe (pointer events : tactile ET souris) ─────────────────────────────
  // touch-action:pan-y laisse le scroll vertical au navigateur ; on ne capture
  // le geste qu'une fois l'intention horizontale avérée (>8px et plus large
  // que haut), pour ne jamais gêner ni le scroll ni le tap sur un geocoin.
  const onPointerDown = (e) => {
    if (totalPages <= 1 || committing.current) return
    ptr.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false }
  }
  const onPointerMove = (e) => {
    const p = ptr.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (!p.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      p.active = true
      setDragging(true)
      try { viewportRef.current?.setPointerCapture(e.pointerId) } catch { /* déjà relâché */ }
    }
    // Résistance élastique quand on tire au-delà de la première/dernière page
    const atEdge = (dx > 0 && page === 0) || (dx < 0 && page === totalPages - 1)
    setDrag(atEdge ? dx * 0.3 : dx)
  }
  const onPointerEnd = (e) => {
    const p = ptr.current
    if (!p || p.id !== e.pointerId) return
    ptr.current = null
    if (!p.active) return
    justDragged.current = true
    setTimeout(() => { justDragged.current = false }, 120)
    const w   = viewportRef.current?.clientWidth || 1
    const dx  = e.clientX - p.x
    const dir = dx < 0 ? 1 : -1
    setDragging(false)
    if (Math.abs(dx) > Math.max(56, w * 0.18) && page + dir >= 0 && page + dir < totalPages) {
      doCommit(dir)
    } else {
      setSettle(true); setDrag(0)
      setTimeout(() => setSettle(false), 320)
    }
  }
  // Un swipe ne doit pas ouvrir le geocoin sous le doigt au relâchement
  const onClickCapture = (e) => {
    if (justDragged.current) { e.preventDefault(); e.stopPropagation() }
  }

  // ── Flèches clavier (desktop) ───────────────────────────────────────────────
  useEffect(() => {
    if (totalPages <= 1 || !keysEnabled) return
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight') doCommit(1)
      else if (e.key === 'ArrowLeft') doCommit(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, totalPages, keysEnabled])   // doCommit lit page via la closure → re-bind à chaque page

  // ── Géométrie du rail ───────────────────────────────────────────────────────
  // 3 panes (page-1, page, page+1) ; le rail est centré sur le pane du milieu
  // (-100%) et glisse de ±100% lors d'un engagement.
  const basePct = -100 - commit * 100
  const w = viewportRef.current?.clientWidth || 1
  // Progression continue du geste (-1…1) : pilote l'inclinaison 3D et la
  // mise en retrait des pages voisines, y compris pendant la transition.
  const prog = commit !== 0 ? commit : -drag / w
  const rotY = Math.max(-4, Math.min(4, prog * -4))
  const trackTransition = dragging ? 'none'
    : commit !== 0 ? `transform ${COMMIT_MS / 1000}s cubic-bezier(.22,1,.36,1)`
    : settle ? 'transform .32s cubic-bezier(.22,1,.36,1)'
    : 'none'

  const showHint = isMobile && totalPages > 1 && !hintSeen
  useEffect(() => {
    if (!showHint) return
    const to = setTimeout(markHintSeen, 6000)
    return () => clearTimeout(to)
  }, [showHint])

  const canPrev = page > 0
  const canNext = page < totalPages - 1
  const navBtn = (enabled) => ({
    width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
    background: enabled ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : theme.bgInput,
    color: enabled ? '#fff' : theme.textMuted,
    boxShadow: enabled ? '0 4px 14px #6c5ce755' : 'none',
    cursor: enabled ? 'pointer' : 'default',
    fontWeight: 900, fontSize: 17, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .2s', fontFamily: "'Nunito',sans-serif",
  })

  return (
    <>
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        // Sur PC, tirer depuis une image déclenche le drag natif HTML5 (image
        // fantôme) qui avale nos pointer events : on le neutralise pour que le
        // geste reste un glissement de page. userSelect coupe aussi la sélection
        // de texte (noms de cartes) pendant le mouvement.
        onDragStart={(e) => e.preventDefault()}
        style={{ overflow: 'hidden', touchAction: 'pan-y', position: 'relative', perspective: 1200, marginBottom: 12, userSelect: 'none' }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', transformStyle: 'preserve-3d',
          transform: `translateX(calc(${basePct}% + ${drag}px)) rotateY(${rotY}deg)`,
          transition: trackTransition,
          willChange: 'transform',
        }}>
          {[page - 1, page, page + 1].map((pIdx) => {
            const rel  = pIdx - page
            const dist = Math.min(1, Math.abs(rel - prog))
            return (
              <div key={pIdx} style={{
                width: '100%', flexShrink: 0, boxSizing: 'border-box',
                transform: `scale(${1 - dist * 0.05})`,
                opacity: 1 - dist * 0.3,
                transition: dragging ? 'none' : `transform ${COMMIT_MS / 1000}s ease, opacity ${COMMIT_MS / 1000}s ease`,
              }}>
                {pIdx >= 0 && pIdx < totalPages ? renderPage(pIdx) : null}
              </div>
            )
          })}
        </div>

        {/* Balayage lumineux droite→gauche à l'arrivée sur une page */}
        {sweep > 0 && (
          <div key={sweep} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: 'linear-gradient(105deg,transparent,#ffffff10 38%,#f9ca241f 52%,transparent 75%)', animation: 'collSweep .65s ease-out both' }} />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
            <button onClick={() => doCommit(-1)} disabled={!canPrev} style={navBtn(canPrev)} aria-label="Page précédente">‹</button>

            {totalPages <= 10 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => doJump(i)} aria-label={`Page ${i + 1}`} style={{
                    width: i === page ? 22 : 8, height: 8, borderRadius: 50, border: 'none', padding: 0,
                    background: i === page ? 'linear-gradient(90deg,#f9ca24,#e17055)' : theme.border,
                    boxShadow: i === page ? '0 0 10px #f9ca2466' : 'none',
                    cursor: i === page ? 'default' : 'pointer',
                    transition: 'all .35s cubic-bezier(.34,1.56,.64,1)',
                  }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 90 }}>
                <span style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 800, fontFamily: "'Nunito',sans-serif" }}>{page + 1} / {totalPages}</span>
                <div style={{ width: 90, height: 3, borderRadius: 3, background: theme.border, overflow: 'hidden' }}>
                  <div style={{ width: `${((page + 1) / totalPages) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#f9ca24,#e17055)', transition: 'width .4s cubic-bezier(.22,1,.36,1)' }} />
                </div>
              </div>
            )}

            <button onClick={() => doCommit(1)} disabled={!canNext} style={navBtn(canNext)} aria-label="Page suivante">›</button>
          </div>

          <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>({count})</div>

          {showHint && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: theme.textSecondary, fontWeight: 700, fontFamily: "'Nunito',sans-serif", animation: 'collHintFade .4s ease both' }}>
              <span style={{ display: 'inline-block', animation: 'collHint 1.5s ease-in-out infinite' }}>👈</span>
              {hintText}
            </div>
          )}
        </div>
      )}
    </>
  )
}
