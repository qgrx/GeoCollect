import { useEffect, useRef } from 'react'
import EditableText from './EditableText.jsx'
import RichTextEditor from './RichTextEditor.jsx'
import RichContent from './RichContent.jsx'
import { useDocsContent } from './useDocsContent.js'

function EmailImage({ email, color }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const font = '600 15px "Nunito", Arial, sans-serif'
    ctx.font = font
    const w = ctx.measureText(email).width + 4
    canvas.width  = Math.ceil(w)
    canvas.height = 22
    ctx.font = font
    ctx.fillStyle = color
    ctx.fillText(email, 2, 16)
  }, [email, color])
  return <canvas ref={canvasRef} style={{ verticalAlign: 'middle', display: 'inline-block' }} aria-label="adresse email support" />
}

export default function SupportContent({ theme, mode, textColor, mutedColor, editMode }) {
  const { content: sections, update, save, reset, saving, dirty, loading, error, saveError, uid } = useDocsContent('support')
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  function changeSection(i, updated) { update(sections.map((s, j) => j === i ? updated : s)) }
  function removeSection(i) { update(sections.filter((_, j) => j !== i)) }
  function addSection() { update([{ id: uid(), icon: '💬', title: '', desc: '' }, ...sections]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold }}>💬 Support</div>
        {editMode && !loading && !error && (
          <button onClick={addSection} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>
            + Section
          </button>
        )}
      </div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Besoin d'aide ? On est là.</div>

      {/* Contact — non éditable (email protégé) */}
      <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>🐛</div>
        <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Un bug ou un problème ?</div>
        <div style={{ fontSize: 14, color: mutedColor, lineHeight: 1.7, marginBottom: 20 }}>
          Erreur d'affichage, paiement non crédité, geocoin manquant… Décrivez le problème et nous vous répondrons rapidement.
        </div>
        <div style={{ background: mode === 'light' ? '#f0f5ff' : '#ffffff0a', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: mutedColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Email de contact</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📧</span>
            <EmailImage email="contact@geocoins.fr" color={theme.gold || '#f9ca24'} />
          </div>
          <div style={{ fontSize: 12, color: mutedColor }}>Pensez à inclure votre pseudo, une description et si possible une capture d'écran.</div>
        </div>
      </div>

      {loading && <div style={{ color: mutedColor, fontSize: 13, padding: '10px 0' }}>Chargement…</div>}

      {!loading && error && (
        <div style={{ color: mutedColor, fontSize: 13, padding: '16px 18px', background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12 }}>
          ⚠️ Contenu momentanément indisponible. Réessaie plus tard.
        </div>
      )}

      {/* Sections éditables */}
      {!loading && !error && sections.map((s, i) => (
        <div key={s.id} style={{ background: cardBg, border: `1px solid ${editMode ? '#f9ca2433' : borderCol}`, borderRadius: 12, padding: '16px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
          {editMode ? (
            <input value={s.icon} onChange={e => changeSection(i, { ...s, icon: e.target.value })}
              style={{ fontSize: 22, width: 40, background: 'transparent', border: '1px solid #ffffff22', borderRadius: 6, textAlign: 'center', padding: '2px', cursor: 'text', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
          )}
          <div style={{ flex: 1 }}>
            <EditableText value={s.title} editing={editMode} placeholder="Titre de la section…" onChange={v => changeSection(i, { ...s, title: v })} tag="div" style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: textColor }} />
            {editMode
              ? <RichTextEditor value={s.desc} onChange={v => changeSection(i, { ...s, desc: v })} placeholder="Description…" mode={mode} />
              : <RichContent html={s.desc} style={{ fontSize: 13, color: textColor }} />
            }
          </div>
          {editMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              {i > 0 && <button onClick={() => { const a=[...sections];[a[i-1],a[i]]=[a[i],a[i-1]];update(a) }} style={{ background:'#ffffff15',border:'none',color:mutedColor,borderRadius:4,width:22,height:22,cursor:'pointer',fontSize:11 }}>↑</button>}
              {i < sections.length-1 && <button onClick={() => { const a=[...sections];[a[i],a[i+1]]=[a[i+1],a[i]];update(a) }} style={{ background:'#ffffff15',border:'none',color:mutedColor,borderRadius:4,width:22,height:22,cursor:'pointer',fontSize:11 }}>↓</button>}
              <button onClick={() => removeSection(i)} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
        </div>
      ))}

      {editMode && !loading && !error && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { if (window.confirm('Restaurer le contenu par défaut ?')) reset() }} style={{ background: '#ffffff10', border: '1px solid #ffffff22', color: mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>↺ Défauts</button>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '8px 18px', borderRadius: 8, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
          {saveError && <span style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700, alignSelf: 'center' }}>⚠️ Échec — réessaie.</span>}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: mutedColor }}>
        Geocoins est un projet indépendant — merci pour votre patience et votre soutien 💚
      </div>
    </div>
  )
}
