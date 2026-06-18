import { useEffect, useRef } from 'react'
import { useTheme } from '../../ThemeContext.jsx'

function EmailImage({ email, color = '#00b894' }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const font = '500 15px "Nunito", Arial, sans-serif'
    ctx.font = font
    const w = ctx.measureText(email).width + 4
    canvas.width  = Math.ceil(w)
    canvas.height = 22
    ctx.font = font
    ctx.fillStyle = color
    ctx.fillText(email, 2, 16)
  }, [email, color])
  return <canvas ref={canvasRef} style={{ verticalAlign: 'middle', display: 'inline-block' }} aria-label="adresse email de support" />
}

export default function SupportPage({ onClose }) {
  const { theme } = useTheme()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2500,
      background: theme.bgBase || '#0f1923',
      overflowY: 'auto',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: "'Fredoka One', sans-serif", fontSize: 26, color: theme.gold }}>
              🗺️ Support Geocoins
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>geocoins.fr</div>
          </div>
          {onClose && (
            // Croix fixe : la page scrolle entièrement, on garde la fermeture toujours visible
            <button onClick={onClose} style={{ position: 'fixed', top: 'max(14px, env(safe-area-inset-top))', right: 14, zIndex: 10, background: '#000000aa', border: `1px solid ${theme.border}`, color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', fontWeight: 900 }}>✕</button>
          )}
        </div>

        {/* Carte principale */}
        <div style={{ background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '24px', marginBottom: 20 }}>
          <div style={{ fontSize: 22, marginBottom: 12 }}>🐛</div>
          <div style={{ fontWeight: 900, fontSize: 17, color: theme.textPrimary, marginBottom: 8 }}>
            Un bug ou un problème ?
          </div>
          <div style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>
            Vous avez rencontré un problème technique, une erreur d'affichage, un paiement non crédité ou tout autre souci ? Décrivez-le nous et nous vous répondrons dans les plus brefs délais.
          </div>

          <div style={{ background: theme.overlayMd, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>
              Contactez-nous par mail
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📧</span>
              <EmailImage email="contact@geocoins.fr" color={theme.gold || '#f9ca24'} />
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              Pensez à inclure : votre pseudo, une description du problème et si possible une capture d'écran.
            </div>
          </div>
        </div>

        {/* Autres raisons */}
        {[
          { icon: '💳', title: 'Problème de paiement', desc: 'Pack acheté non crédité, double débit, remboursement…' },
          { icon: '🔐', title: 'Problème de compte', desc: 'Connexion impossible, mot de passe oublié, compte bloqué…' },
          { icon: '💡', title: 'Suggestion', desc: 'Une idée pour améliorer Geocoins ? On est tout ouïe.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{ background: theme.overlay, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 800, color: theme.textPrimary, fontSize: 13, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 12, color: theme.textSecondary }}>{desc}</div>
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: theme.textMuted }}>
          Geocoins est un projet indépendant. Merci pour votre patience et votre soutien 💚
        </div>
      </div>
    </div>
  )
}
