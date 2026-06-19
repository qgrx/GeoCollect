import { useState } from 'react'
import EditableText from './EditableText.jsx'
import RichTextEditor from './RichTextEditor.jsx'
import { useDocsContent } from './useDocsContent.js'
import { sanitizeHtml } from '../../utils/sanitize.js'

function FaqItem({ item, idx, total, editing, onChange, onRemove, onMoveUp, onMoveDown, colors, mode }) {
  const canUp = idx > 0, canDown = idx < total - 1
  colors = { ...colors, mode }
  const [open, setOpen] = useState(false)
  const { cardBg, borderCol, textColor, mutedColor } = colors

  return (
    <div style={{ background: cardBg, border: `1px solid ${editing ? '#f9ca2444' : borderCol}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px' }}>
        <button onClick={() => setOpen(o => !o)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, color: textColor, textAlign: 'left', padding: 0 }}>
          <EditableText
            value={item.q}
            editing={editing}
            placeholder="Nouvelle question…"
            onChange={q => onChange({ ...item, q })}
            style={{ fontWeight: 800, fontSize: 14, color: textColor, flex: 1 }}
          />
          {!editing && <span style={{ flexShrink: 0, fontSize: 18, color: mutedColor, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>}
        </button>
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <button onClick={onMoveUp}   disabled={!canUp}   style={{ background: canUp   ? '#ffffff15' : 'transparent', border: 'none', color: canUp   ? colors.mutedColor : '#ffffff22', borderRadius: 4, width: 22, height: 22, cursor: canUp   ? 'pointer' : 'default', fontSize: 11 }}>↑</button>
            <button onClick={onMoveDown} disabled={!canDown} style={{ background: canDown ? '#ffffff15' : 'transparent', border: 'none', color: canDown ? colors.mutedColor : '#ffffff22', borderRadius: 4, width: 22, height: 22, cursor: canDown ? 'pointer' : 'default', fontSize: 11 }}>↓</button>
          </div>
        )}
        {editing && (
          <button onClick={onRemove} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14, fontWeight: 900, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        )}
      </div>
      {(open || editing) && (
        <div style={{ padding: '4px 18px 16px', borderTop: `1px solid ${borderCol}` }}>
          {editing
            ? <RichTextEditor value={item.a} onChange={a => onChange({ ...item, a })} placeholder="Réponse…" mode={colors.mode} />
            : <div style={{ fontSize: 14, color: mutedColor, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.a) }} />
          }
        </div>
      )}
    </div>
  )
}

export default function FaqPage({ theme, mode, textColor, mutedColor, isAdmin, editMode }) {
  const { content: items, update, save, reset, saving, dirty, loading, error, saveError, uid } = useDocsContent('faq')
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'
  const colors    = { cardBg, borderCol, textColor, mutedColor }

  function changeItem(idx, updated) {
    const next = items.map((it, i) => i === idx ? updated : it)
    update(next)
  }
  function removeItem(idx) { update(items.filter((_, i) => i !== idx)) }
  function addItem() { update([{ id: uid(), q: '', a: '' }, ...items]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold }}>❓ FAQ</div>
        {editMode && !loading && !error && (
          <button onClick={addItem} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>
            + Question
          </button>
        )}
      </div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Questions fréquemment posées</div>

      {loading && <div style={{ color: mutedColor, fontSize: 13, padding: '20px 0' }}>Chargement…</div>}

      {!loading && error && (
        <div style={{ color: mutedColor, fontSize: 13, padding: '16px 18px', background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12 }}>
          ⚠️ Contenu momentanément indisponible. Réessaie plus tard.
        </div>
      )}

      {!loading && !error && items.map((item, i) => (
        <FaqItem key={item.id} item={item} idx={i} total={items.length} editing={editMode} mode={mode}
          onChange={u => changeItem(i, u)}
          onRemove={() => removeItem(i)}
          onMoveUp={() => { const a = [...items]; [a[i-1],a[i]]=[a[i],a[i-1]]; update(a) }}
          onMoveDown={() => { const a = [...items]; [a[i],a[i+1]]=[a[i+1],a[i]]; update(a) }}
          colors={colors} />
      ))}

      {editMode && !loading && !error && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { if (window.confirm('Restaurer le contenu par défaut ?')) reset() }} style={{ background: '#ffffff10', border: '1px solid #ffffff22', color: colors.mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>↺ Défauts</button>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '8px 18px', borderRadius: 8, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
          {saveError && <span style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700, alignSelf: 'center' }}>⚠️ Échec — réessaie.</span>}
        </div>
      )}
    </div>
  )
}
