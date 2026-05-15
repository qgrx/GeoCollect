import EditableText from './EditableText.jsx'
import RichTextEditor from './RichTextEditor.jsx'
import { useDocsContent } from './useDocsContent.js'
import { sanitizeHtml } from '../../utils/sanitize.js'

const TYPE_OPTIONS = ['✨', '🔧', '🐛', '📋']

export default function ReleaseNotesPage({ theme, mode, textColor, mutedColor, editMode }) {
  const { content: releases, update, save, reset, saving, dirty } = useDocsContent('release-notes')
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  function updateRelease(ri, updated) {
    update(releases.map((r, i) => i === ri ? updated : r))
  }
  function updateItem(ri, ii, updated) {
    updateRelease(ri, { ...releases[ri], items: releases[ri].items.map((it, i) => i === ii ? updated : it) })
  }
  function removeItem(ri, ii) {
    updateRelease(ri, { ...releases[ri], items: releases[ri].items.filter((_, i) => i !== ii) })
  }
  function addItem(ri) {
    updateRelease(ri, { ...releases[ri], items: [...releases[ri].items, { type: '✨', text: 'Nouvelle entrée' }] })
  }
  function removeRelease(ri) { update(releases.filter((_, i) => i !== ri)) }
  function addRelease() { update([{ version: 'vX.X — Mois XXXX', items: [{ type: '✨', text: 'Nouvelle entrée' }] }, ...releases]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold }}>📋 Release Notes</div>
        {editMode && (
          <button onClick={addRelease} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>
            + Version
          </button>
        )}
      </div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Historique des mises à jour</div>

      {releases.map((rel, ri) => (
        <div key={ri} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />
            <EditableText value={rel.version} editing={editMode} onChange={v => updateRelease(ri, { ...rel, version: v })} style={{ fontWeight: 900, fontSize: 16 }} />
            {editMode && (<>
              {ri > 0 && <button onClick={() => { const a=[...releases];[a[ri-1],a[ri]]=[a[ri],a[ri-1]];update(a) }} style={{ background:'#ffffff15',border:'none',color:mutedColor,borderRadius:4,width:22,height:22,cursor:'pointer',fontSize:11 }}>↑</button>}
              {ri < releases.length-1 && <button onClick={() => { const a=[...releases];[a[ri],a[ri+1]]=[a[ri+1],a[ri]];update(a) }} style={{ background:'#ffffff15',border:'none',color:mutedColor,borderRadius:4,width:22,height:22,cursor:'pointer',fontSize:11 }}>↓</button>}
              <button onClick={() => removeRelease(ri)} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>×</button>
            </>)}
          </div>
          <div style={{ background: cardBg, border: `1px solid ${editMode ? '#f9ca2433' : borderCol}`, borderRadius: 12, padding: '14px 18px' }}>
            {rel.items.map((item, ii) => (
              <div key={ii} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: ii < rel.items.length - 1 ? `1px solid ${borderCol}` : 'none' }}>
                {editMode ? (
                  <select value={item.type} onChange={e => updateItem(ri, ii, { ...item, type: e.target.value })}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, flexShrink: 0 }}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{item.type}</span>
                )}
                {editMode
                  ? <div style={{ flex: 1 }}><RichTextEditor value={item.text} onChange={t => updateItem(ri, ii, { ...item, text: t })} mode={mode} /></div>
                  : <span style={{ fontSize: 13, color: mutedColor, lineHeight: 1.6, flex: 1 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.text) }} />
                }
                {editMode && (<>
                  {ii > 0 && <button onClick={() => { const it=[...rel.items];[it[ii-1],it[ii]]=[it[ii],it[ii-1]];updateRelease(ri,{...rel,items:it}) }} style={{ background:'none',border:'none',color:mutedColor,cursor:'pointer',fontSize:11,padding:'0 2px' }}>↑</button>}
                  {ii < rel.items.length-1 && <button onClick={() => { const it=[...rel.items];[it[ii],it[ii+1]]=[it[ii+1],it[ii]];updateRelease(ri,{...rel,items:it}) }} style={{ background:'none',border:'none',color:mutedColor,cursor:'pointer',fontSize:11,padding:'0 2px' }}>↓</button>}
                  <button onClick={() => removeItem(ri, ii)} style={{ background: 'none', border: 'none', color: '#e74c3c88', cursor: 'pointer', fontSize: 14, flexShrink: 0, padding: '0 4px' }}>×</button>
                </>)}
              </div>
            ))}
            {editMode && (
              <button onClick={() => addItem(ri)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontSize: 11, fontWeight: 700, marginTop: 8, padding: '4px 0' }}>
                + Ajouter une entrée
              </button>
            )}
          </div>
        </div>
      ))}

      {editMode && (
        <>
          <button onClick={() => { if (window.confirm('Restaurer le contenu par défaut ?')) reset() }} style={{ background: '#ffffff10', border: '1px solid #ffffff22', color: mutedColor, padding: '10px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, marginTop: 8, marginRight: 8 }}>
            ↺ Restaurer défauts
          </button>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '10px 22px', borderRadius: 9, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, marginTop: 8 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer les Release Notes' : '✓ Enregistré'}
          </button>
        </>
      )}
    </div>
  )
}
