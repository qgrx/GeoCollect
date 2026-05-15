import { useRef, useEffect } from 'react'

/**
 * Texte éditable inline via contenteditable.
 * En mode lecture : rendu normal. En mode édition : bordure dorée + curseur.
 *
 * NB : on laisse le DOM être la source de vérité pendant la frappe.
 * On n'écrit jamais `textContent` depuis React pendant l'édition (cursor flip).
 */
export default function EditableText({ value, onChange, editing, tag: Tag = 'span', style = {}, multiline = false }) {
  const ref = useRef()

  // Initialise le contenu DOM uniquement quand on entre en mode édition
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.textContent = value
      // Placer le curseur à la fin
      const range = document.createRange()
      const sel   = window.getSelection()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing])

  if (!editing) return <Tag style={style}>{value}</Tag>

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={e => onChange?.(e.currentTarget.textContent)}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') e.preventDefault() }}
      style={{
        ...style,
        outline: '2px solid #f9ca2466',
        borderRadius: 4,
        padding: '1px 4px',
        cursor: 'text',
        minWidth: 40,
        display: Tag === 'span' ? 'inline-block' : undefined,
        whiteSpace: multiline ? 'pre-wrap' : undefined,
      }}
    />
  )
}
