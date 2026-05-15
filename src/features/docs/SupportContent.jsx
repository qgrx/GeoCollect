import { useEffect, useRef } from 'react'

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

export default function SupportContent({ theme, mode, textColor, mutedColor }) {
  const cardBg     = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol  = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, marginBottom: 6 }}>💬 Support</div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Besoin d'aide ? On est là.</div>

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
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.5 }}>
            Merci d'inclure votre pseudo, une description du problème et si possible une capture d'écran.
          </div>
        </div>
      </div>

      {[
        { icon: '💳', title: 'Problème de paiement', desc: 'Pack acheté non crédité, double débit ou remboursement — précisez le montant et la date.' },
        { icon: '🔐', title: 'Problème de compte', desc: 'Connexion impossible, mot de passe oublié, compte bloqué ou supprimé par erreur.' },
        { icon: '💡', title: 'Suggestion ou amélioration', desc: 'Une idée pour améliorer Geocoins ? Partagez-la, toutes les suggestions sont lues.' },
      ].map(({ icon, title, desc }) => (
        <div key={title} style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12, padding: '16px 18px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.6 }}>{desc}</div>
          </div>
        </div>
      ))}

      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: mutedColor }}>
        Geocoins est un projet indépendant — merci pour votre patience et votre soutien 💚
      </div>
    </div>
  )
}
