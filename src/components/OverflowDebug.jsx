import { useEffect, useState } from 'react'

// ── Sonde de débordement horizontal (outil de diagnostic, pas une feature) ────
// Symptôme à élucider : sur Android, quand l'annonce « en feu » apparaît, TOUS
// les éléments sortent de l'écran à droite et dézoomer ne les ramène pas. La
// lecture du CSS ne suffit pas à désigner un coupable — le bandeau est en
// `overflow:hidden` dans un conteneur `flex:1;minWidth:0`, il ne PEUT pas
// élargir la page. On mesure donc sur l'appareil où ça se reproduit.
//
// Éteinte par défaut, pour tout le monde. Activation : ouvrir le site avec
// `?ovf=1` (mémorisé), désactivation avec `?ovf=0`. Aucun joueur ne peut tomber
// dessus par accident.
//
// Deux questions auxquelles le panneau répond d'un coup d'œil :
//   1. `scale` — si > 1, la page est ZOOMÉE (geste tactile) et le reste suit ;
//      si = 1, c'est bien la mise en page qui est plus large que l'écran.
//   2. `doc` vs `écran` — largeur réellement occupée par le document, et QUELS
//      éléments dépassent, en ne gardant que les vrais coupables (un enfant qui
//      dépasse juste parce que son parent déborde n'est pas listé).

const KEY = 'gc_ovf_debug'

function describe(el) {
  const bits = [el.tagName.toLowerCase()]
  if (el.id) bits.push('#' + el.id)
  const tour = el.getAttribute?.('data-tour')
  if (tour) bits.push('[' + tour + ']')
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
  if (cls) bits.push('.' + cls)
  const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
  if (txt) bits.push('«' + txt + '»')
  return bits.join(' ')
}

export default function OverflowDebug() {
  const [on, setOn] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let enabled = false
    try {
      const q = new URLSearchParams(window.location.search).get('ovf')
      if (q === '1') localStorage.setItem(KEY, '1')
      if (q === '0') localStorage.removeItem(KEY)
      enabled = localStorage.getItem(KEY) === '1'
    } catch { /* stockage indisponible → sonde éteinte */ }
    setOn(enabled)
  }, [])

  useEffect(() => {
    if (!on) return
    const scan = () => {
      const doc = document.documentElement
      const w = doc.clientWidth
      // Un élément « coupable » dépasse à droite SANS que son parent dépasse
      // autant : sinon on listerait tout le sous-arbre d'un seul fautif.
      const guilty = []
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right <= w + 1 && r.left >= -1) continue
        const p = el.parentElement
        const pr = p ? p.getBoundingClientRect() : null
        if (pr && pr.right > w + 1 && pr.right >= r.right - 1 && pr.left <= r.left + 1) continue
        guilty.push({ d: describe(el), r: Math.round(r.right), l: Math.round(r.left) })
        if (guilty.length >= 14) break
      }
      const vv = window.visualViewport
      setInfo({
        w,
        scrollW: Math.round(doc.scrollWidth),
        bodyW: Math.round(document.body.scrollWidth),
        inner: window.innerWidth,
        scale: vv ? Math.round(vv.scale * 100) / 100 : '—',
        vvW: vv ? Math.round(vv.width) : '—',
        vvOff: vv ? Math.round(vv.offsetLeft) : '—',
        dpr: window.devicePixelRatio,
        guilty,
      })
    }
    scan()
    const i = setInterval(scan, 700)
    window.addEventListener('resize', scan)
    window.visualViewport?.addEventListener('resize', scan)
    return () => {
      clearInterval(i)
      window.removeEventListener('resize', scan)
      window.visualViewport?.removeEventListener('resize', scan)
    }
  }, [on])

  if (!on || !info) return null
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2147483647,
      background: '#000000ee', color: '#7CFC98', font: '10px/1.35 monospace',
      padding: '5px 6px', maxHeight: '38vh', overflowY: 'auto', pointerEvents: 'none',
      borderTop: '1px solid #7CFC98',
    }}>
      <div style={{ color: '#fff' }}>
        écran {info.w} · inner {info.inner} · doc {info.scrollW} · body {info.bodyW}
        {' · '}scale {info.scale} · vv {info.vvW}@{info.vvOff} · dpr {info.dpr}
      </div>
      {info.guilty.length === 0
        ? <div>aucun élément ne dépasse</div>
        : info.guilty.map((g, i) => (
            <div key={i} style={{ color: '#ffb07a' }}>{g.l}→{g.r} {g.d}</div>
          ))}
    </div>
  )
}
