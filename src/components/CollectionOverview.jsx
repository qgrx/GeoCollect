import { cardCC, cardName } from '../data/cards.js'

// ── Vue d'ensemble « tout en un » de la collection ───────────────────────────
// Toutes les cartes du filtre courant sur une seule page, manquantes comprises
// (grisées, révélées au survol) — même principe que la grille inventaire de
// l'admin (AdminPlayers), en version joueur : vignettes compactes, clic →
// fiche détaillée (mêmes règles d'ouverture que la grille classique).

const OVERVIEW_CSS = `
@keyframes overviewPop { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
`
function injectOverviewStyle() {
  if (document.getElementById('coll-overview-styles')) return
  const s = document.createElement('style')
  s.id = 'coll-overview-styles'
  s.textContent = OVERVIEW_CSS
  document.head.appendChild(s)
}
injectOverviewStyle()

export default function CollectionOverview({ items, theme, isMobile, lang, onSelect }) {
  const w = isMobile ? 52 : 64
  const h = Math.round(w * 1.3)

  return (
    <div style={{ animation: 'fadeIn .3s ease', padding: '18px 0 8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 5 : 7, justifyContent: 'center' }}>
        {items.map(({ card, count, cnt, missing, isShiny }, idx) => {
          const c = count || cnt || 0
          const { c1 } = cardCC(card.rarity)
          const thumb = card.image_url_thumb || card.thumbnail || card.image_url || card.image
          const isAchievement = card.type?.toLowerCase().startsWith('achievement')
          const clickable = !missing || isAchievement
          return (
            <div key={`${card.id}${isShiny ? '_shiny' : ''}`}
              onClick={clickable ? () => onSelect(card, !!isShiny, isAchievement) : undefined}
              title={cardName(card, lang)}
              style={{
                position: 'relative', width: w,
                cursor: clickable ? 'pointer' : 'default',
                opacity: missing ? 0.3 : 1,
                filter: missing ? 'grayscale(1)' : 'none',
                transition: 'opacity .15s, transform .12s, filter .15s',
                animation: `overviewPop .3s ${Math.min(idx * 0.008, 0.4)}s ease both`,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'scale(1.14)'; e.currentTarget.style.zIndex = '10' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = missing ? '0.3' : '1'; e.currentTarget.style.filter = missing ? 'grayscale(1)' : 'none'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1' }}
            >
              <div style={{
                width: w, height: h, borderRadius: 8, overflow: 'hidden', boxSizing: 'border-box',
                border: `2px solid ${missing ? theme.border : isShiny ? '#f9ca24' : c1}`,
                boxShadow: isShiny && !missing ? '0 0 8px #f9ca2466' : 'none',
                background: thumb ? 'transparent' : `linear-gradient(135deg,${c1}44,${c1}22)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {thumb
                  ? <img src={thumb} alt={card.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 16, fontWeight: 900, color: c1, fontFamily: "'Nunito',sans-serif" }}>{card.name[0]}</span>}
              </div>
              {isShiny && !missing && <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 9, lineHeight: 1, pointerEvents: 'none' }}>✨</div>}
              {c > 1 && (
                <div style={{ position: 'absolute', top: 2, right: 2, background: '#000000bb', color: '#fff', fontSize: 8, fontWeight: 900, borderRadius: 4, padding: '1px 3px', lineHeight: 1.2, fontFamily: "'Nunito',sans-serif" }}>×{c}</div>
              )}
              <div style={{ fontSize: 7.5, color: missing ? theme.textMuted : theme.textSecondary, textAlign: 'center', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>
                {cardName(card, lang)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
