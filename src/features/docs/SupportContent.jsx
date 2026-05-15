import { useEffect, useRef } from 'react'
import EditableText from './EditableText.jsx'
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
  const { content: sections, update, save, saving, dirty } = useDocsContent('support')
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  function changeSection(i, updated) { update(sections.map((s, j) => j === i ? updated : s)) }
  function removeSection(i) { update(sections.filter((_, j) => j !== i)) }
  function addSection() { update([...sections, { icon: '💬', title: 'Nouvelle section', desc: 'Description…' }]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, marginBottom: 6 }}>💬 Support</div>
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

      {/* Sections éditables */}
      {sections.map((s, i) => (
        <div key={i} style={{ background: cardBg, border: `1px solid ${editMode ? '#f9ca2433' : borderCol}`, borderRadius: 12, padding: '16px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
          {editMode ? (
            <input value={s.icon} onChange={e => changeSection(i, { ...s, icon: e.target.value })}
              style={{ fontSize: 22, width: 40, background: 'transparent', border: '1px solid #ffffff22', borderRadius: 6, textAlign: 'center', padding: '2px', cursor: 'text', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
          )}
          <div style={{ flex: 1 }}>
            <EditableText value={s.title} editing={editMode} onChange={v => changeSection(i, { ...s, title: v })} tag="div" style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: textColor }} />
            <EditableText value={s.desc} editing={editMode} onChange={v => changeSection(i, { ...s, desc: v })} tag="div" multiline style={{ fontSize: 13, color: mutedColor, lineHeight: 1.6 }} />
          </div>
          {editMode && (
            <button onClick={() => removeSection(i)} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 13, fontWeight: 900, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          )}
        </div>
      ))}

      {editMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={addSection} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12 }}>
            + Ajouter une section
          </button>
          <button onClick={save} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '8px 18px', borderRadius: 8, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: mutedColor }}>
        Geocoins est un projet indépendant — merci pour votre patience et votre soutien 💚
      </div>
    </div>
  )
}
