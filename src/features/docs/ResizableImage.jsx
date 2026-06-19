import { useRef } from 'react'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

// Style appliqué à l'<img> dans le HTML enregistré (et donc en lecture). Reproduit
// exactement le placement choisi dans l'éditeur : largeur, habillage du texte.
function imageStyle(width, align) {
  let s = 'height:auto;max-width:100%;border-radius:8px;'
  if (width) s += `width:${width}px;`
  if (align === 'left')        s += 'float:left;margin:4px 16px 8px 0;'
  else if (align === 'right')  s += 'float:right;margin:4px 0 8px 16px;'
  else if (align === 'center') s += 'display:block;margin:10px auto;'
  else                         s += 'display:block;margin:10px 0;'
  return s
}

function readWidth(el) {
  const m = (el.style?.width || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}
function readAlign(el) {
  const css = el.style?.cssText || ''
  if (/float:\s*left/.test(css))       return 'left'
  if (/float:\s*right/.test(css))      return 'right'
  if (/margin:[^;]*\bauto\b/.test(css)) return 'center'
  return 'none'
}

function ImageNodeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null)
  const { src, alt, width, align } = node.attrs
  const editable = editor.isEditable

  function startResize(e) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = imgRef.current?.offsetWidth || 200
    const onMove = ev => {
      const next = Math.max(60, Math.round(startW + (ev.clientX - startX)))
      updateAttributes({ width: next })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const wrapStyle =
    align === 'left'   ? { float: 'left',  margin: '4px 16px 8px 0' } :
    align === 'right'  ? { float: 'right', margin: '4px 0 8px 16px' } :
    align === 'center' ? { display: 'block', textAlign: 'center', margin: '10px 0' } :
                         { display: 'block', margin: '10px 0' }

  const btn = active => ({
    background: active ? '#f9ca24' : '#1a2435ee', color: active ? '#1e3045' : '#fff',
    border: 'none', borderRadius: 5, width: 26, height: 24, cursor: 'pointer',
    fontSize: 13, lineHeight: '24px', padding: 0, fontWeight: 700,
  })

  return (
    <NodeViewWrapper className="rs-img" style={wrapStyle}>
      <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          draggable={false}
          style={{
            width: width ? `${width}px` : undefined,
            maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block',
            outline: selected && editable ? '2px solid #f9ca24' : 'none',
          }}
        />
        {selected && editable && (
          <>
            {/* Poignée de redimensionnement (coin bas-droit) */}
            <span
              onPointerDown={startResize}
              title="Redimensionner"
              style={{
                position: 'absolute', right: -5, bottom: -5, width: 14, height: 14,
                background: '#f9ca24', border: '2px solid #fff', borderRadius: '50%',
                cursor: 'nwse-resize', boxShadow: '0 1px 4px #0006',
              }}
            />
            {/* Barre d'habillage / alignement */}
            <span style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 3, background: '#0f1923cc', padding: 3, borderRadius: 7 }}>
              <button onMouseDown={e => e.preventDefault()} onClick={() => updateAttributes({ align: 'left' })}   title="Texte à droite (image à gauche)" style={btn(align === 'left')}>⬅</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => updateAttributes({ align: 'center' })} title="Centrer (pas d'habillage)"        style={btn(align === 'center')}>▢</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => updateAttributes({ align: 'right' })}  title="Texte à gauche (image à droite)"  style={btn(align === 'right')}>➡</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => updateAttributes({ align: 'none', width: null })} title="Réinitialiser" style={btn(false)}>↺</button>
            </span>
          </>
        )}
      </span>
    </NodeViewWrapper>
  )
}

// Image avec largeur + habillage persistés dans le style de l'<img> (round-trip via
// sanitizeHtml qui autorise l'attribut style), et une NodeView de redimensionnement.
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: readWidth,  renderHTML: () => ({}) },
      align: { default: 'none', parseHTML: readAlign, renderHTML: () => ({}) },
    }
  },
  renderHTML({ HTMLAttributes, node }) {
    const { style: _s, width: _w, align: _a, ...rest } = HTMLAttributes
    void _s; void _w; void _a
    return ['img', { ...rest, style: imageStyle(node.attrs.width, node.attrs.align) }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})

export default ResizableImage
