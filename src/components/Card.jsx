import { RARITY_CONFIG as RC, cardCC } from '../data/cards.js';
import { useT } from '../i18n/translations.js';

const SHINY_CSS = `
@keyframes rainbowScreen {
  0%   { background-position: 0% 0%; }
  100% { background-position: 300% 300%; }
}
@keyframes sp { 0%,100%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(180deg)} }
@keyframes textShine {
  0%     { background-position: -200% center; }
  62.5%  { background-position: 200% center; }
  62.6%  { background-position: -200% center; }
  100%   { background-position: -200% center; }
}
`
function injectShinyStyle() {
  if (document.getElementById('shiny-styles')) return
  const s = document.createElement('style')
  s.id = 'shiny-styles'
  s.textContent = SHINY_CSS
  document.head.appendChild(s)
}
injectShinyStyle()

const SPARKLES = [
  { top:'18%', left:'28%', size:13, delay:0,    color:'#fff' },
  { top:'12%', left:'62%', size:9,  delay:0.28, color:'#f9ca24' },
  { top:'35%', left:'18%', size:7,  delay:0.55, color:'#fff' },
  { top:'28%', left:'50%', size:11, delay:0.82, color:'#ff69b4' },
  { top:'45%', left:'75%', size:8,  delay:1.1,  color:'#4fc3f7' },
  { top:'74%', left:'32%', size:10, delay:0.38, color:'#fff' },
  { top:'82%', left:'58%', size:9,  delay:0.65, color:'#f9ca24' },
  { top:'68%', left:'48%', size:7,  delay:0.93, color:'#ce93d8' },
  { top:'22%', left:'38%', size:11, delay:0.15, color:'#fff' },
  { top:'40%', left:'72%', size:8,  delay:1.3,  color:'#69f0ae' },
]

export const ShinyEffect = ({ size = 'normal' }) => {
  const scale = size === 'large' ? 1.5 : size === 'small' ? 0.65 : 1
  return (
    <>
      {/* Scintillements */}
      {SPARKLES.map((sp, i) => (
        <div key={i} style={{
          position:'absolute', top:sp.top, left:sp.left, zIndex:6,
          fontSize: sp.size * scale, lineHeight:1,
          color:sp.color,
          animation:`sp 1.8s ease-in-out infinite`,
          animationDelay:`${sp.delay}s`,
          filter:`drop-shadow(0 0 ${Math.round(sp.size*scale*0.4)}px #fff) drop-shadow(0 0 ${Math.round(sp.size*scale*0.6)}px ${sp.color})`,
          pointerEvents:'none',
        }}>✦</div>
      ))}
    </>
  )
}

export default function Card({ card, count, onClick, selected, small, dimmed, isShiny = false }) {
  const { t } = useT()
  const rc = RC[card.rarity] || RC.commun
  const { c1, c2 } = cardCC(card.rarity)
  const isLeg = card.rarity === 'légendaire'
  const hasImage = !!(card.image || card.image_url)
  const w = small ? 100 : 148
  const h = small ? 130 : 190

  return (
    <div onClick={onClick} style={{
      position:'relative', width:w, minWidth:w, height:h, borderRadius:16,
      border: selected ? '2.5px solid #f9ca24' : isLeg ? `2px solid ${c1}` : dimmed ? '1.5px solid #ffffff18' : `1.5px solid ${c1}66`,
      animation: 'none',
      boxShadow: isShiny ? `0 0 18px #f9ca2466, 0 4px 20px #0004` : selected ? `0 0 0 3px #f9ca2466,0 8px 28px #0004` : isLeg ? `0 0 20px ${c1}66,0 4px 20px #0004` : dimmed ? 'none' : `0 4px 14px #0003`,
      cursor: onClick ? 'pointer' : 'default',
      overflow:'hidden', userSelect:'none',
      opacity: dimmed ? 0.35 : 1,
      filter: dimmed ? 'grayscale(1)' : 'none',
      transform: selected ? 'translateY(-6px) scale(1.03)' : 'none',
      transition:'transform .15s',
      background: hasImage ? 'transparent' : `linear-gradient(145deg,${c1}44,${c2}66)`,
    }}
      onMouseEnter={e => { if (onClick && !dimmed) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'translateY(-3px) scale(1.02)' }}
      onMouseLeave={e => { if (onClick && !dimmed) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'none' }}
      onTouchStart={e => { if (onClick && !dimmed) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'translateY(-3px) scale(1.02)' }}
      onTouchEnd={e => { if (onClick && !dimmed) setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'none' }, 150) }}
    >
      {isLeg && !dimmed && !isShiny && (
        <div style={{position:'absolute',inset:0,borderRadius:16,zIndex:2,background:'linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)',backgroundSize:'400px 100%',animation:'shimmer 2.5s linear infinite',pointerEvents:'none'}}/>
      )}

      {isShiny && <ShinyEffect size={small ? 'small' : 'normal'} />}

      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop: small ? 4 : 6}}>
        {hasImage ? (
          <img src={card.image||card.image_url} alt={card.name} style={{
            width:'100%', height:'88%', objectFit:'contain', display:'block',
            animation: 'none',
          }}/>
        ) : (
          <div style={{fontSize: small ? 36 : 52, opacity: dimmed ? 0.1 : 0.22}}>🃏</div>
        )}
      </div>

      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:4,background: isShiny ? 'linear-gradient(to top,#b8860bee 0%,#b8860b99 50%,transparent 100%)' : `linear-gradient(to top,${c1}ee 0%,${c1}99 50%,transparent 100%)`,padding: small ? '18px 6px 5px' : '28px 8px 7px',textAlign:'center'}}>
        <div style={{fontWeight:900,fontSize: small ? 10 : 13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:0.3,fontFamily:"'Nunito',sans-serif",
          ...({ color: '#fff', textShadow: '0 1px 4px #0008' })
        }}>
          {card.name}
        </div>
      </div>

      {!dimmed && <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:5,height: small ? 3 : 4,background: isShiny ? 'linear-gradient(90deg,#b8860b,#f9ca24,#ffe066,#f9ca24,#b8860b)' : `linear-gradient(90deg,${c1},${c2})`}}/>}

      {count > 1 && <div style={{position:'absolute',top:5,right:5,zIndex:6,background:'#000000bb',color:'#fff',borderRadius:'50%',width: small ? 16 : 20,height: small ? 16 : 20,fontSize: small ? 8 : 10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif"}}>×{count}</div>}

      {dimmed && <div style={{position:'absolute',inset:0,zIndex:3,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:10,color:'#555',fontWeight:700,fontFamily:"'Nunito',sans-serif",background:'#000000aa',padding:'3px 8px',borderRadius:50}}>Manquante</div></div>}

      {selected && <div style={{position:'absolute',inset:0,zIndex:1,borderRadius:14,background:'#f9ca2408',pointerEvents:'none'}}/>}
    </div>
  )
}
