import { useState, useEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'
import { BTN, INP } from '../../utils/styles.js'

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function passwordStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score  // 0–5
}

const STRENGTH_COLOR = ['#e74c3c','#e74c3c','#f39c12','#f9ca24','#00b894','#00b894']
const STRENGTH_LABEL = ['','Très faible','Faible','Correct','Fort','Très fort']

function StrengthBar({ pw }) {
  const s = passwordStrength(pw)
  if (!pw) return null
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
            background: i <= s ? STRENGTH_COLOR[s] : '#ffffff18',
            transition: 'background .3s' }}/>
        ))}
      </div>
      <div style={{ fontSize: 10, color: STRENGTH_COLOR[s], fontWeight: 700 }}>
        {STRENGTH_LABEL[s]}
      </div>
    </div>
  )
}

function PwInput({ value, onChange, placeholder, onEnter }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={onChange} type={show ? 'text' : 'password'}
        placeholder={placeholder}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        style={{ ...INP, marginBottom: 0, paddingRight: 38 }}/>
      <button onClick={() => setShow(v => !v)} tabIndex={-1}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 15, padding: 2 }}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  )
}

// ─── AuthModal ────────────────────────────────────────────────────────────────
export default function AuthModal({ onClose, auth, onSuccess, initialMode = 'choice' }) {
  const { t } = useT()
  // modes: choice | login | register | forgot | forgot_sent | reset_pw | confirm_email | choose_pseudo
  const [mode,    setMode]    = useState(initialMode)
  const [email,   setEmail]   = useState('')
  const [pseudo,  setPseudo]  = useState('')
  const [pw,      setPw]      = useState('')
  const [pw2,     setPw2]     = useState('')
  const [msg,     setMsg]     = useState({ text: '', type: 'error' })
  const [busy,    setBusy]    = useState(false)
  const [regTurnstileToken, setRegTurnstileToken] = useState(null)
  const regTurnstileRef = useRef()
  const regWidgetId = useRef(null)

  // Charger Turnstile pour l'inscription
  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
    if (!siteKey || mode !== 'register') return
    function init() {
      if (!regTurnstileRef.current || !window.turnstile) return
      if (regWidgetId.current) return
      regWidgetId.current = window.turnstile.render(regTurnstileRef.current, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        execution: 'execute',
        callback: token => setRegTurnstileToken(token),
        'error-callback': () => setRegTurnstileToken(null),
        'expired-callback': () => setRegTurnstileToken(null),
      })
    }
    if (window.turnstile) { init(); return }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true; s.onload = init
    document.head.appendChild(s)
    return () => {
      if (regWidgetId.current && window.turnstile) {
        window.turnstile.remove(regWidgetId.current)
        regWidgetId.current = null
      }
    }
  }, [mode])

  // Détecter lien de reset mot de passe (retour depuis email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === '1') setMode('reset_pw')
  }, [])

  function err(text) { setMsg({ text, type: 'error' }) }
  function ok(text)  { setMsg({ text, type: 'ok' }) }
  function clear()   { setMsg({ text: '', type: 'error' }) }

  function reset() { setEmail(''); setPseudo(''); setPw(''); setPw2(''); clear() }

  function errMsg(code) {
    const map = {
      'Invalid login credentials':        '❌ Email ou mot de passe incorrect.',
      'Email not confirmed':              '📧 Confirme ton email avant de te connecter.',
      'pseudo_taken':                     '❌ Ce pseudo est déjà utilisé.',
      'User already registered':          '❌ Compte déjà existant — connecte-toi.',
      'Password should be at least 6':    '❌ Mot de passe trop court (6 caractères min).',
      'Unable to validate email address': '❌ Adresse email invalide.',
      'domain_not_allowed':               '❌ ' + t('auth_domain_not_allowed'),
    }
    for (const [k, v] of Object.entries(map)) {
      if (code?.includes(k)) return v
    }
    return code || '❌ Une erreur est survenue.'
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function doGoogle() {
    setBusy(true); clear()
    const { error } = await auth.signInWithGoogle()
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
  }

  async function doFacebook() {
    setBusy(true); clear()
    const { error } = await auth.signInWithFacebook()
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
    // Après OAuth, le profile est chargé — forcer le choix de pseudo si celui du fournisseur
    // En pratique, Google redirige, donc onAuthStateChange gérera la suite.
    // Si mode local on ferme, sinon l'utilisateur sera redirigé
    onClose()
  }

  async function doChoosePseudo() {
    if (!pseudo.trim() || pseudo.trim().length < 3) { err(t('auth_pseudo_short')); return }
    setBusy(true); clear()
    const { error } = await auth.updatePseudo(pseudo.trim())
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
    onSuccess?.(auth.profile)
    onClose()
  }

  async function doLogin() {
    if (!email.trim() || !pw) { err(t('auth_fill_fields')); return }
    setBusy(true); clear()
    const { data, error } = await auth.signInWithEmail(email.trim(), pw)
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
    // Attendre que le profil soit chargé (onAuthStateChange l'a déclenché)
    const waitProfile = () => new Promise(res => {
      const start = Date.now()
      const poll = () => {
        if (auth.profile || Date.now() - start > 3000) return res()
        setTimeout(poll, 100)
      }
      poll()
    })
    await waitProfile()
    onSuccess?.(auth.profile)
    onClose()
  }

  async function doRegister() {
    if (!pseudo.trim() || !email.trim() || !pw) { err(t('auth_fill_fields')); return }
    if (pseudo.trim().length < 3) { err(t('auth_pseudo_short')); return }
    if (pw !== pw2) { err('❌ Les mots de passe ne correspondent pas.'); return }
    if (passwordStrength(pw) < 2) { err('❌ Mot de passe trop faible.'); return }
    // Vérification Turnstile si configuré
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !regTurnstileToken) {
      err('🤖 Validation anti-bot en cours, réessaie dans un instant.')
      if (regWidgetId.current && window.turnstile) window.turnstile.execute(regWidgetId.current)
      return
    }
    setBusy(true); clear()
    const { error } = await auth.signUpWithEmail(email.trim(), pw, pseudo.trim())
    setBusy(false)
    if (error) {
      err(errMsg(error.message));
      if (regWidgetId.current && window.turnstile) window.turnstile.reset(regWidgetId.current);
      setRegTurnstileToken(null);
      return;
    }
    if (auth.profile) { onSuccess?.(auth.profile); onClose(); return }
    setMode('confirm_email')
  }

  async function doForgot() {
    if (!email.trim()) { err('Saisis ton email.'); return }
    setBusy(true); clear()
    const { error } = await auth.resetPassword(email.trim())
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
    setMode('forgot_sent')
  }

  async function doResetPw() {
    if (!pw) { err('Saisis un nouveau mot de passe.'); return }
    if (pw !== pw2) { err('❌ Les mots de passe ne correspondent pas.'); return }
    if (passwordStrength(pw) < 2) { err('❌ Mot de passe trop faible.'); return }
    setBusy(true); clear()
    const { error } = await auth.updatePassword(pw)
    setBusy(false)
    if (error) { err(errMsg(error.message)); return }
    // Nettoyer l'URL
    window.history.replaceState({}, '', window.location.pathname)
    ok('✅ Mot de passe mis à jour ! Tu peux te connecter.')
    setTimeout(() => { setMode('login'); reset() }, 2000)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  const BtnMain = ({ onClick, gradient, children }) => (
    <button onClick={onClick} disabled={busy}
      style={{ ...BTN(gradient || 'linear-gradient(135deg,#f9ca24,#e17055)', gradient ? '#fff' : '#1e3045'),
        padding: '12px', borderRadius: 12, textAlign: 'center',
        opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
      {busy ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', verticalAlign: 'middle' }}/> : children}
    </button>
  )

  const Back = ({ to }) => (
    <button onClick={() => { setMode(to || 'choice'); reset() }}
      style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer',
        fontFamily: "'Nunito',sans-serif", marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
      ← {t('auth_back')}
    </button>
  )

  const Msg = () => msg.text ? (
    <div style={{ fontSize: 12, fontWeight: 700, padding: '8px 12px', borderRadius: 9, marginTop: 2,
      background: msg.type === 'ok' ? '#00b89422' : '#e74c3c22',
      color: msg.type === 'ok' ? '#00b894' : '#e74c3c',
      border: `1px solid ${msg.type === 'ok' ? '#00b89444' : '#e74c3c44'}` }}>
      {msg.text}
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000d', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(10px)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ background: 'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius: 24,
        padding: '32px 28px', width: 'min(94vw,420px)', border: '1.5px solid #ffffff18',
        boxShadow: '0 32px 80px #000b', fontFamily: "'Nunito',sans-serif", position: 'relative',
        animation: 'fadeIn .3s ease' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14,
          background: '#ffffff18', border: 'none', color: '#fff', width: 30, height: 30,
          borderRadius: '50%', fontSize: 15, cursor: 'pointer', fontWeight: 900 }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#f9ca24' }}>🗺️ Geocoins</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            {mode === 'login'        && 'Connexion à ton compte'}
            {mode === 'register'     && 'Créer un compte'}
            {mode === 'choice'       && t('auth_subtitle')}
            {mode === 'forgot'       && 'Mot de passe oublié'}
            {mode === 'forgot_sent'  && 'Email envoyé'}
            {mode === 'confirm_email'&& 'Confirme ton email'}
            {mode === 'reset_pw'     && 'Nouveau mot de passe'}
          </div>
        </div>

        {/* ── CHOIX ── */}
        {mode === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={doGoogle} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
                border: 'none', color: '#1e3045', padding: '12px 16px', borderRadius: 12,
                fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {t('auth_google')}
            </button>

            <button onClick={doFacebook} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1877F2',
                border: 'none', color: '#fff', padding: '12px 16px', borderRadius: 12,
                fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.1 24 12.073z"/>
              </svg>
              {t('auth_facebook') || 'Continuer avec Facebook'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: '#ffffff18' }}/>
              <span style={{ fontSize: 11, color: '#555' }}>{t('auth_or')}</span>
              <div style={{ flex: 1, height: 1, background: '#ffffff18' }}/>
            </div>

            <button onClick={() => setMode('login')}
              style={{ background: '#ffffff12', border: '1px solid #ffffff22', color: '#fff',
                padding: '11px', borderRadius: 12, fontFamily: "'Nunito',sans-serif",
                fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              {t('auth_email_login')}
            </button>
            <BtnMain onClick={() => setMode('register')} gradient="linear-gradient(135deg,#6c5ce7,#a29bfe)">
              {t('auth_create')}
            </BtnMain>
          </div>
        )}

        {/* ── CONNEXION ── */}
        {mode === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Back to="choice"/>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder={t('auth_email')} style={{ ...INP, marginBottom: 0 }}
              onKeyDown={e => e.key === 'Enter' && doLogin()}/>
            <PwInput value={pw} onChange={e => setPw(e.target.value)}
              placeholder={t('auth_password')} onEnter={doLogin}/>
            <button onClick={() => { setMode('forgot'); clear() }}
              style={{ background: 'none', border: 'none', color: '#6c5ce7', fontSize: 11,
                cursor: 'pointer', fontFamily: "'Nunito',sans-serif", textAlign: 'right' }}>
              Mot de passe oublié ?
            </button>
            <Msg/>
            <BtnMain onClick={doLogin}>{t('auth_signin')}</BtnMain>
            <button onClick={() => { setMode('register'); reset() }}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: 11,
                cursor: 'pointer', fontFamily: "'Nunito',sans-serif", textAlign: 'center' }}>
              {t('auth_no_account_short')}
            </button>
          </div>
        )}

        {/* ── INSCRIPTION ── */}
        {mode === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Back to="choice"/>
            <div>
              <input value={pseudo} onChange={e => setPseudo(e.target.value)}
                placeholder={t('auth_pseudo')} style={{ ...INP, marginBottom: 0 }}
                maxLength={20}/>
              <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>3–20 caractères, unique</div>
            </div>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder={t('auth_email')} style={{ ...INP, marginBottom: 0 }}/>
            <div>
              <PwInput value={pw} onChange={e => setPw(e.target.value)}
                placeholder={t('auth_password')}/>
              <StrengthBar pw={pw}/>
            </div>
            <PwInput value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="Confirmer le mot de passe" onEnter={doRegister}/>
            {pw2 && pw !== pw2 && (
              <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>
                Les mots de passe ne correspondent pas.
              </div>
            )}
        <div ref={regTurnstileRef} style={{ display: 'flex', justifyContent: 'center' }}/>
            <Msg/>
            <BtnMain onClick={doRegister} gradient="linear-gradient(135deg,#6c5ce7,#a29bfe)">
              {t('auth_signup')}
            </BtnMain>
            <button onClick={() => { setMode('login'); reset() }}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: 11,
                cursor: 'pointer', fontFamily: "'Nunito',sans-serif", textAlign: 'center' }}>
              Déjà un compte ? Se connecter
            </button>
          </div>
        )}

        {/* ── MOT DE PASSE OUBLIÉ ── */}
        {mode === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Back to="login"/>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4, lineHeight: 1.5 }}>
              Saisis ton email — on t'envoie un lien pour réinitialiser ton mot de passe.
            </div>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder={t('auth_email')} style={{ ...INP, marginBottom: 0 }}
              onKeyDown={e => e.key === 'Enter' && doForgot()}/>
            <Msg/>
            <BtnMain onClick={doForgot}>Envoyer le lien</BtnMain>
          </div>
        )}

        {/* ── EMAIL ENVOYÉ ── */}
        {mode === 'forgot_sent' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <div style={{ fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 8 }}>Email envoyé !</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>
              Vérifie ta boîte mail ({email}) et clique sur le lien pour réinitialiser ton mot de passe.
            </div>
            <button onClick={() => { setMode('login'); reset() }}
              style={{ background: '#ffffff18', border: 'none', color: '#fff', padding: '10px 20px',
                borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12,
                cursor: 'pointer' }}>
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ── CONFIRMATION EMAIL ── */}
        {mode === 'confirm_email' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
            <div style={{ fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 8 }}>Vérifie ton email</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 12 }}>
              Un email de confirmation a été envoyé à <span style={{ color: '#f9ca24' }}>{email}</span>.<br/>
              Clique sur le lien pour activer ton compte.
            </div>
            <div style={{ fontSize: 11, color: '#666', background: '#ffffff08', border: '1px solid #ffffff14', borderRadius: 8, padding: '8px 12px', marginBottom: 20, lineHeight: 1.6 }}>
              📬 L'email est envoyé depuis <span style={{ color: '#aaa' }}>hello@mail.geocoin.fr</span>.<br/>
              Si tu ne le vois pas, pense à vérifier tes <span style={{ color: '#f9ca24' }}>spams</span>.
            </div>
            <button onClick={() => { setMode('login'); reset() }}
              style={{ background: '#ffffff18', border: 'none', color: '#fff', padding: '10px 20px',
                borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12,
                cursor: 'pointer' }}>
              J'ai confirmé → Me connecter
            </button>
          </div>
        )}

        {/* ── RÉINITIALISATION MDP ── */}
        {mode === 'reset_pw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
              Choisis ton nouveau mot de passe.
            </div>
            <div>
              <PwInput value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Nouveau mot de passe"/>
              <StrengthBar pw={pw}/>
            </div>
            <PwInput value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="Confirmer le mot de passe" onEnter={doResetPw}/>
            <Msg/>
            <BtnMain onClick={doResetPw}>Enregistrer le mot de passe</BtnMain>
          </div>
        )}

        {/* ── CHOISIR PSEUDO (après Google OAuth) ── */}
        {mode === 'choose_pseudo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 4 }}>
              Choisis un pseudo unique — c'est le nom que les autres joueurs verront.<br/>
              <span style={{ fontSize: 11, color: '#555' }}>Ton nom Google ne sera visible que des admins.</span>
            </div>
            <input value={pseudo} onChange={e => setPseudo(e.target.value)}
              placeholder={t('auth_pseudo')} style={{ ...INP, marginBottom: 0 }}
              maxLength={20} onKeyDown={e => e.key === 'Enter' && doChoosePseudo()}/>
            <Msg/>
            <BtnMain onClick={doChoosePseudo} gradient="linear-gradient(135deg,#6c5ce7,#a29bfe)">
              Valider mon pseudo
            </BtnMain>
          </div>
        )}

      </div>
    </div>
  )
}
