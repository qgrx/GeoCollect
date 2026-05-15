import { useRef, useEffect, useCallback } from 'react'

const COLORS = ['#f9ca24', '#e17055', '#00b894', '#74b9ff', '#a29bfe', '#fd79a8', '#e74c3c', '#636e72', '#2d3436', '#ffffff']

const SIZES = [
  { label: 'Normal', tag: 'p' },
  { label: 'Titre',  tag: 'h2' },
  { label: 'Sous-titre', tag: 'h3' },
]

function ToolBtn({ label, title, active, onClick, style = {} }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        background: active ? '#f9ca2433' : 'transparent',
        border: `1px solid ${active ? '#f9ca2466' : 'transparent'}`,
        color: active ? '#f9ca24' : '#ccc',
        borderRadius: 5,
        padding: '3px 7px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.4,
        transition: 'all .1s',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder = '', mode = 'dark' }) {
  const ref = useRef()
  const selRef = useRef(null)

  // Initialise le DOM uniquement au montage
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ''
  }, []) // eslint-disable-line

  // Sauvegarde la sélection avant que le toolbar ne vole le focus
  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) selRef.current = sel.getRangeAt(0).cloneRange()
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (sel && selRef.current) {
      sel.removeAllRanges()
      sel.addRange(selRef.current)
    }
    ref.current?.focus()
  }

  const exec = useCallback((cmd, val) => {
    restoreSelection()
    document.execCommand(cmd, false, val ?? null)
    if (ref.current) onChange?.(ref.current.innerHTML)
  }, [onChange])

  function queryState(cmd) {
    try { return document.queryCommandState(cmd) } catch { return false }
  }

  const bg     = mode === 'light' ? '#f8f9fa' : '#0f1923'
  const border = mode === 'light' ? '#d0d7de' : '#ffffff22'
  const text   = mode === 'light' ? '#1e2d3d' : '#d4e8f8'

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid #f9ca2466`, overflow: 'visible' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '5px 8px', background: mode === 'light' ? '#f0f0f0' : '#1a2435', borderBottom: `1px solid ${border}`, borderRadius: '8px 8px 0 0' }}>

        {/* Format de bloc */}
        <select
          onMouseDown={e => saveSelection()}
          onChange={e => exec('formatBlock', e.target.value)}
          defaultValue="p"
          style={{ background: mode === 'light' ? '#fff' : '#0f1923', border: `1px solid ${border}`, color: text, borderRadius: 5, padding: '3px 6px', fontSize: 12, cursor: 'pointer', marginRight: 4 }}
        >
          {SIZES.map(s => <option key={s.tag} value={s.tag}>{s.label}</option>)}
        </select>

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label={<b>G</b>}  title="Gras (Ctrl+B)"       onClick={() => exec('bold')}          active={queryState('bold')} />
        <ToolBtn label={<i>I</i>}  title="Italique (Ctrl+I)"   onClick={() => exec('italic')}        active={queryState('italic')} />
        <ToolBtn label={<u>S</u>}  title="Souligné"             onClick={() => exec('underline')}     active={queryState('underline')} style={{ textDecoration: 'underline' }} />
        <ToolBtn label={<s>B</s>}  title="Barré"                onClick={() => exec('strikeThrough')} active={queryState('strikeThrough')} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="A−" title="Réduire la taille" onClick={() => exec('decreaseFontSize')} />
        <ToolBtn label="A+" title="Agrandir la taille" onClick={() => exec('increaseFontSize')} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="≡" title="Aligner à gauche"   onClick={() => exec('justifyLeft')}   active={queryState('justifyLeft')} />
        <ToolBtn label="≡" title="Centrer"             onClick={() => exec('justifyCenter')} active={queryState('justifyCenter')} style={{ letterSpacing: 1 }} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        {/* Palette de couleurs */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {COLORS.map(c => (
            <button
              key={c}
              onMouseDown={e => { e.preventDefault(); exec('foreColor', c) }}
              title={c}
              style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1.5px solid #ffffff33', cursor: 'pointer', padding: 0, flexShrink: 0 }}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="✕" title="Effacer la mise en forme" onClick={() => exec('removeFormat')} style={{ color: '#e74c3c88' }} />
      </div>

      {/* ── Zone de texte ── */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onSelect={saveSelection}
        onKeyUp={saveSelection}
        onInput={e => onChange?.(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{
          minHeight: 80,
          padding: '10px 14px',
          background: bg,
          color: text,
          fontSize: 14,
          lineHeight: 1.7,
          outline: 'none',
          borderRadius: '0 0 8px 8px',
          wordBreak: 'break-word',
        }}
      />
    </div>
  )
}
