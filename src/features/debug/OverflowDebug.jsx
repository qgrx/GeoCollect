import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY DE DEBUG TEMPORAIRE — traque les éléments qui dépassent le viewport en
// largeur (cause des barres de défilement horizontales rapportées sur certains
// WebView où `overflow-x: clip` n'est pas honoré). Gaté sur un pseudo précis
// depuis App.jsx (n'apparaît QUE pour ce compte). À RETIRER une fois le coupable
// identifié — cf. import + rendu dans App.jsx, tout est marqué « OverflowDebug ».
//
// Ce qu'il affiche :
//   • scrollWidth vs clientWidth du document → dit s'il y a un VRAI débordement
//     horizontal sur CE téléphone (delta > 0 = barre de défilement réelle).
//   • la liste des éléments dont le bord droit dépasse (ou le bord gauche < 0),
//     du pire au moins grave, avec un descripteur lisible.
//   • bouton « Copier » → colle la liste dans le chat pour l'analyser.
//   • tap sur une ligne → surligne l'élément et le fait défiler à l'écran.
// ─────────────────────────────────────────────────────────────────────────────

const describe = (el) => {
  const tag  = el.tagName.toLowerCase()
  const id   = el.id ? `#${el.id}` : ''
  const cls  = (typeof el.className === 'string' && el.className.trim())
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : ''
  const tour = el.dataset?.tour ? `[${el.dataset.tour}]` : ''
  const txt  = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22)
  return `${tag}${id}${cls}${tour}${txt ? ` "${txt}"` : ''}`
}

export default function OverflowDebug({ enabled }) {
  const [items, setItems]     = useState([])
  const [delta, setDelta]     = useState(0)   // scrollWidth - clientWidth
  const [open,  setOpen]      = useState(true)
  const [copied, setCopied]   = useState(false)
  const lastHi = useRef(null)                 // dernier élément surligné

  const scan = useCallback(() => {
    const doc = document.documentElement
    const vw  = doc.clientWidth
    setDelta(Math.max(doc.scrollWidth, document.body.scrollWidth) - vw)

    const found = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.dataset && el.dataset.ovdbg) continue           // ignore l'overlay lui-même
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const overR = r.right - vw
      const overL = -r.left
      const over  = Math.max(overR, overL)
      if (over > 1) found.push({ el, over: Math.round(over), right: Math.round(r.right), width: Math.round(r.width), side: overR >= overL ? 'R' : 'L' })
    }
    found.sort((a, b) => b.over - a.over)
    setItems(found.slice(0, 40))
  }, [])

  useEffect(() => {
    if (!enabled) return
    scan()
    const id = setInterval(scan, 1000)
    window.addEventListener('resize', scan)
    window.addEventListener('scroll', scan, true)
    return () => { clearInterval(id); window.removeEventListener('resize', scan); window.removeEventListener('scroll', scan, true) }
  }, [enabled, scan])

  const highlight = (el) => {
    if (lastHi.current && lastHi.current !== el) { lastHi.current.style.outline = ''; lastHi.current.style.outlineOffset = '' }
    el.style.outline = '3px solid #ff3b3b'
    el.style.outlineOffset = '-1px'
    lastHi.current = el
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }

  const copy = () => {
    const vw = document.documentElement.clientWidth
    const header = `overflow-x: scrollW=${Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)} clientW=${vw} delta=+${delta}px | UA=${navigator.userAgent}`
    const lines = items.map(it => `+${it.over}px ${it.side}  right=${it.right} w=${it.width}  ${describe(it.el)}`)
    const text = [header, ...lines].join('\n')
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => {
      window.prompt('Copie manuelle :', text); done()
    })
    else { window.prompt('Copie manuelle :', text); done() }
  }

  if (!enabled) return null

  const box = {
    position: 'fixed', left: 8, bottom: 'calc(72px + env(safe-area-inset-bottom))',
    zIndex: 2147483647, width: 'min(92vw, 380px)', maxWidth: 'calc(100vw - 16px)',
    background: 'rgba(10,12,20,.94)', color: '#e6e6e6',
    border: '1px solid #ff3b3b66', borderRadius: 10,
    font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
    boxShadow: '0 12px 40px #000b', overflow: 'hidden',
  }

  return (
    <div data-ovdbg="1" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: delta > 0 ? '#ff3b3b22' : '#00b89422', borderBottom: '1px solid #ffffff14' }}>
        <span style={{ fontWeight: 800 }}>🐞 overflow</span>
        <span style={{ color: delta > 0 ? '#ff6b6b' : '#3fd6a0', fontWeight: 800 }}>
          {delta > 0 ? `+${delta}px horizontal` : 'aucun scroll H'}
        </span>
        <span style={{ marginLeft: 'auto', opacity: .7 }}>{items.length} elt(s)</span>
        <button data-ovdbg="1" onClick={copy}
          style={{ background: '#ffffff18', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
          {copied ? '✓' : 'Copier'}
        </button>
        <button data-ovdbg="1" onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', padding: '0 2px' }}>
          {open ? '▾' : '▸'}
        </button>
      </div>

      {open && (
        <div data-ovdbg="1" style={{ maxHeight: '38vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {items.length === 0 ? (
            <div style={{ padding: '10px 9px', opacity: .7 }}>Aucun élément ne dépasse le viewport 👍</div>
          ) : items.map((it, i) => (
            <button key={i} data-ovdbg="1" onClick={() => highlight(it.el)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: i % 2 ? '#ffffff08' : 'transparent',
                border: 'none', borderBottom: '1px solid #ffffff0d', color: '#e6e6e6',
                padding: '6px 9px', font: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: '#ff8a8a', fontWeight: 800 }}>+{it.over}px {it.side}</span>
              <span style={{ opacity: .55 }}> · r{it.right} w{it.width} · </span>
              <span>{describe(it.el)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
