import { useState } from 'react'
import EditableText from './EditableText.jsx'
import { useDocsContent } from './useDocsContent.js'

function FaqItem({ item, idx, editing, onChange, onRemove, colors }) {
  const [open, setOpen] = useState(false)
  const { cardBg, borderCol, textColor, mutedColor } = colors

  return (
    <div style={{ background: cardBg, border: `1px solid ${editing ? '#f9ca2444' : borderCol}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px' }}>
        <button onClick={() => setOpen(o => !o)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, color: textColor, textAlign: 'left', padding: 0 }}>
          <EditableText
            value={item.q}
            editing={editing}
            onChange={q => onChange({ ...item, q })}
            style={{ fontWeight: 800, fontSize: 14, color: textColor, flex: 1 }}
          />
          {!editing && <span style={{ flexShrink: 0, fontSize: 18, color: mutedColor, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>}
        </button>
        {editing && (
          <button onClick={onRemove} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14, fontWeight: 900, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        )}
      </div>
      {(open || editing) && (
        <div style={{ padding: '4px 18px 16px', borderTop: `1px solid ${borderCol}` }}>
          <EditableText
            value={item.a}
            editing={editing}
            onChange={a => onChange({ ...item, a })}
            tag="div"
            multiline
            style={{ fontSize: 14, color: mutedColor, lineHeight: 1.7 }}
          />
        </div>
      )}
    </div>
  )
}

export default function FaqPage({ theme, mode, textColor, mutedColor, isAdmin, editMode }) {
  const { content: items, update, save, reset, saving, dirty } = useDocsContent('faq')
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'
  const colors    = { cardBg, borderCol, textColor, mutedColor }

  function changeItem(idx, updated) {
    const next = items.map((it, i) => i === idx ? updated : it)
    update(next)
  }
  function removeItem(idx) { update(items.filter((_, i) => i !== idx)) }
  function addItem() { update([...items, { q: 'Nouvelle question', a: 'Réponse…' }]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, marginBottom: 6 }}>❓ FAQ</div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Questions fréquemment posées</div>

      {items.map((item, i) => (
        <FaqItem key={i} item={item} idx={i} editing={editMode} onChange={u => changeItem(i, u)} onRemove={() => removeItem(i)} colors={colors} />
      ))}

      {editMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={addItem} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12 }}>
            + Ajouter une question
          </button>
          <button onClick={() => { if (window.confirm('Restaurer le contenu par défaut ?')) reset() }} style={{ background: '#ffffff10', border: '1px solid #ffffff22', color: colors.mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>↺ Défauts</button>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '8px 18px', borderRadius: 8, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
        </div>
      )}
    </div>
  )
}
