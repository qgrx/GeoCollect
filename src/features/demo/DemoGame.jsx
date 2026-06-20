/**
 * Mode démo « onboarding » — pièces d'UI greffées sur le VRAI jeu (rendu par App
 * pour les visiteurs anonymes). Le parcours réutilise les vrais composants
 * (CountdownWidget, QuizModal, collection) ; ici on n'ajoute que :
 *   - DemoBanner      : bandeau « mode démo » + progression + bouton s'inscrire.
 *   - DemoSignupWall  : mur d'inscription affiché après les 5 geocoins (conversion
 *                       du compte anonyme en compte définitif, geocoins conservés).
 */
import { useState } from 'react'
import Card from '../../components/Card.jsx'

const PANEL = 'linear-gradient(145deg,#1e3045,#1a2d42)'
const inputStyle = { width: '100%', boxSizing: 'border-box', background: '#ffffff0f', border: '1.5px solid #ffffff22', borderRadius: 11, color: '#fff', padding: '12px 14px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 15, outline: 'none' }

export function DemoBanner({ doneCount, total, onSignup, t }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '7px 14px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12.5, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', background: '#ffffff26', borderRadius: 6, padding: '2px 8px' }}>{t('demo_banner')}</span>
      <span>{t('demo_progress').replace('{n}', doneCount).replace('{total}', total)}</span>
      <button onClick={onSignup} style={{ background: '#fff', color: '#4a36c7', border: 'none', borderRadius: 50, padding: '4px 13px', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>{t('demo_signup_now')}</button>
    </div>
  )
}

export function DemoSignupWall({ auth, onOpenAuth, onClose, earned, earnedCount, t }) {
  const [email, setEmail]       = useState('')
  const [pseudo, setPseudo]     = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')

  async function submit() {
    if (busy) return
    if (!email.trim() || !password || pseudo.trim().length < 3) { setErr(t('demo_wall_incomplete')); return }
    setBusy(true); setErr('')
    const { error } = await auth.convertAnonymous(email.trim(), password, pseudo.trim())
    setBusy(false)
    if (error) { setErr(error.message === 'pseudo_taken' ? t('auth_pseudo_taken') : error.message); return }
    // Succès : l'utilisateur n'est plus anonyme → App bascule sur le jeu complet.
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000d', backdropFilter: 'blur(8px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'relative', width: 'min(94vw,440px)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: PANEL, borderRadius: 22, padding: '24px 20px', border: '1.5px solid #f9ca2433', boxShadow: '0 24px 60px #000a', fontFamily: "'Nunito',sans-serif" }}>
        {onClose && (
          <button onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', top: 12, right: 12, background: '#ffffff14', border: '1px solid #ffffff22', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}>✕</button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#f9ca24' }}>{t('demo_wall_title').replace('{n}', earnedCount ?? earned.length)}</div>
          <div style={{ fontSize: 13.5, color: '#bcd', lineHeight: 1.5, marginTop: 6 }}>{t('demo_wall_sub')}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {earned.map(c => <div key={c.id} style={{ pointerEvents: 'none' }}><Card card={c} small /></div>)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <input value={pseudo} onChange={e => { setPseudo(e.target.value); setErr('') }} placeholder={t('demo_wall_pseudo')} maxLength={20} style={inputStyle} />
          <input value={email} onChange={e => { setEmail(e.target.value); setErr('') }} type="email" placeholder={t('demo_wall_email')} style={inputStyle} />
          <input value={password} onChange={e => { setPassword(e.target.value); setErr('') }} type="password" placeholder={t('demo_wall_password')} onKeyDown={e => { if (e.key === 'Enter') submit() }} style={inputStyle} />
          {err && <div style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700 }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ background: busy ? '#ffffff18' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: busy ? 'default' : 'pointer', marginTop: 4 }}>
            {busy ? '…' : t('demo_wall_cta')}
          </button>
          <button onClick={onOpenAuth} style={{ background: 'none', border: 'none', color: '#9bb0c8', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}>
            {t('demo_wall_have_account')}
          </button>
        </div>
      </div>
    </div>
  )
}
