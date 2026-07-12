import { useState, useRef, useEffect } from 'react'

// ── Défilement continu par lots (collection, forge, marché…) ─────────────────
// Remplace la pagination : les éléments se parcourent en descendant, chargés
// dynamiquement quand la sentinelle en bas de liste approche du viewport
// (IntersectionObserver, marge 600px pour charger avant d'arriver).
// Un bouton flottant « Haut de page » ramène en haut après un vrai défilement.
//
// layout : 'grid' (flex-wrap centré, cartes) ou 'list' (colonne, lignes pleines).
// resetKey : signature des filtres/tri/recherche — on ne repart au premier lot
// que quand ELLE change, pas à chaque nouvelle identité de `items` (sinon une
// mise à jour de données pendant le scroll re-tronquerait la liste).

const SCROLL_CSS = `
@keyframes collBatchIn { from{opacity:0;transform:translateY(16px) scale(.94)} to{opacity:1;transform:none} }
@keyframes collTopBtnIn { from{opacity:0;transform:translateY(14px) scale(.7)} to{opacity:1;transform:none} }
`
function injectScrollStyle() {
  if (document.getElementById('coll-scroll-styles')) return
  const s = document.createElement('style')
  s.id = 'coll-scroll-styles'
  s.textContent = SCROLL_CSS
  document.head.appendChild(s)
}
injectScrollStyle()

// Bouton flottant « Haut de page » — réutilisable seul (ex. classement qui gère
// sa propre pagination serveur). Apparaît après 600px de défilement fenêtre.
export function BackToTop({ theme, isMobile, label }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={label || 'Haut de page'}
      style={{
        position: 'fixed', right: 18, bottom: isMobile ? 84 : 26, zIndex: 190,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: isMobile ? 0 : '11px 18px',
        width: isMobile ? 46 : 'auto', height: isMobile ? 46 : 'auto',
        borderRadius: 50, border: `1px solid ${theme.border}`,
        background: theme.bgSurface, color: theme.textPrimary,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 28px #00000040',
        cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12,
        animation: 'collTopBtnIn .25s cubic-bezier(.34,1.56,.64,1) both',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 34px #00000055' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px #00000040' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
      {!isMobile && <span>{label || 'Haut de page'}</span>}
    </button>
  )
}

export default function CollectionScroll({ items, batch = 24, renderItem, theme, isMobile, resetKey, gridKey, topLabel, layout = 'grid', listGap = 9, showCount = true, showTopBtn = true, initialIndex = null }) {
  // initialIndex : élément à rendre atteignable dès le départ (ex. geocoin ciblé
  // depuis la collection) — on charge d'emblée assez de lots pour qu'il soit
  // dans le DOM, sinon un scrollIntoView ne le trouverait pas.
  const firstVisible = initialIndex != null && initialIndex >= 0
    ? Math.ceil((initialIndex + 1) / batch) * batch
    : batch
  const [visible, setVisible] = useState(firstVisible)
  const sentinelRef = useRef(null)

  // Changement de filtre/tri/recherche → repartir au premier lot
  useEffect(() => { setVisible(firstVisible) }, [resetKey, firstVisible])

  const shown = items.slice(0, visible)
  const hasMore = items.length > shown.length

  // Sentinelle : recréée après chaque lot (observe() re-déclenche immédiatement
  // si elle est encore visible → enchaîne les lots jusqu'à remplir l'écran).
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setVisible(v => Math.min(items.length, v + batch))
    }, { rootMargin: '600px 0px' })
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [hasMore, visible, items.length, batch])

  const containerStyle = layout === 'list'
    ? { display: 'flex', flexDirection: 'column', gap: listGap, marginTop: 18, marginBottom: 16 }
    // marginTop : respiration entre la barre figée au-dessus et la 1ʳᵉ ligne
    : { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: 14, marginTop: 18, marginBottom: 16 }

  return (
    <>
      <div key={gridKey} style={containerStyle}>
        {shown.map((item, idx) => renderItem(item, idx))}
      </div>

      {hasMore ? (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '14px 0 26px' }}>
          {[0, 0.18, 0.36].map(d => (
            <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: theme.gold, animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />
          ))}
        </div>
      ) : showCount ? (
        <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, fontWeight: 700, fontFamily: "'Nunito',sans-serif", padding: '4px 0 16px' }}>
          ({items.length})
        </div>
      ) : null}

      {showTopBtn && <BackToTop theme={theme} isMobile={isMobile} label={topLabel} />}
    </>
  )
}
