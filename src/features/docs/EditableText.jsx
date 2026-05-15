import { useRef, useEffect } from 'react'

/**
 * Texte éditable inline via contenteditable.
 * En mode lecture : rendu normal. En mode édition : bordure dorée + curseur.
 */
export default function EditableText({ value, onChange, editing, tag: Tag = 'span', style = {}, multiline = false }) {
  const ref = useRef()

  // Synchronise le DOM si value change depuis l'extérieur (ex : reset)
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value
    }
  }, [value])

  if (!editing) return <Tag style={style}>{value}</Tag>

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={e => onChange?.(e.currentTarget.textContent)}
      onKeyDown={e => {
        if (!multiline && e.key === 'Enter') { e.preventDefault() }
      }}
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
    >
      {value}
    </Tag>
  )
}
