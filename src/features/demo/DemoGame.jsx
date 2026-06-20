/**
 * Parcours démo « onboarding » — instance de jeu solo et isolée pour les
 * visiteurs non connectés. Le joueur gagne 5 geocoins sans compte (compte
 * anonyme Supabase), puis est invité à s'inscrire pour les conserver. Pas de
 * marché / forge / trésor : composant autonome, indépendant du jeu global.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Card from '../../components/Card.jsx'
import { useT, getLang } from '../../i18n/translations.js'
import { cardName } from '../../data/cards.js'
import { wordCount } from '../../utils/gameUtils.js'
import { apiDemoStart, apiDemoAnswer } from '../../services/api.js'

const PANEL = 'linear-gradient(145deg,#1e3045,#1a2d42)'

export default function DemoGame({ auth, onOpenAuth }) {
  const { t } = useT()
  const [steps, setSteps] = useState(null)   // null = chargement
  const startedRef = useRef(false)

  // Démarrage : le compte anonyme existe déjà (aiguillage App) → charger la séquence.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    apiDemoStart().then(({ data }) => setSteps(data?.steps || [])).catch(() => setSteps([]))
  }, [])

  // État dérivé de `steps` : progression, étape courante, fin de parcours.
  const total     = steps?.length || 5
  const doneCount = steps ? steps.filter(s => s.earned).length : 0
  const current   = steps ? steps.findIndex(s => !s.earned) : -1
  const allDone   = !!steps && steps.length > 0 && current < 0

  // Marque l'étape comme gagnée → la progression et l'étape suivante se recalculent.
  const onSolved = useCallback((stepIdx) => {
    setSteps(prev => (prev || []).map((s, i) => (i === stepIdx ? { ...s, earned: true } : s)))
  }, [])

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: 'linear-gradient(160deg,#16233a,#101a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 14px 40px', fontFamily: "'Nunito',sans-serif" }}>
      <style>{`@keyframes demoPop{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:none}} @keyframes demoShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}`}</style>

      {/* Bandeau démo persistant */}
      <div style={{ width: 'min(96vw,520px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#1e3045', background: '#f9ca24', borderRadius: 6, padding: '3px 8px' }}>{t('demo_banner')}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#ffd28a' }}>{t('demo_progress').replace('{n}', doneCount).replace('{total}', total)}</span>
        </div>
        <button onClick={onOpenAuth} style={{ background: '#ffffff14', border: '1px solid #ffffff22', color: '#fff', padding: '6px 12px', borderRadius: 50, fontWeight: 800, fontSize: 11.5, cursor: 'pointer' }}>{t('demo_signup_now')}</button>
      </div>

      {/* Barre de progression (5 pastilles) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: 26, height: 6, borderRadius: 3, background: i < doneCount ? 'linear-gradient(90deg,#00b894,#00cec9)' : '#ffffff1a' }} />
        ))}
      </div>

      {steps === null ? (
        <div style={{ color: '#9bb0c8', fontWeight: 700, marginTop: 60 }}>{t('demo_loading')}</div>
      ) : allDone ? (
        <SignupWall auth={auth} onOpenAuth={onOpenAuth} earned={steps.filter(s => s.earned).map(s => s.card)} t={t} />
      ) : steps[current] ? (
        <DemoQuiz key={steps[current].step} step={steps[current]} onSolved={onSolved} t={t} />
      ) : (
        <div style={{ color: '#9bb0c8', marginTop: 60 }}>—</div>
      )}
    </div>
  )
}

// ── Une étape de quiz (solo, sans timer compétitif) ───────────────────────────
function DemoQuiz({ step, onSolved, t }) {
  const lang = getLang()
  const tr = step.translations?.[lang]
  const question = tr?.question || step.question
  const wc = step.answer_word_count || wordCount(step.card?.name || '') || 1

  const [inp, setInp]     = useState('')
  const [status, setStatus] = useState('open') // open | won
  const [shake, setShake] = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit() {
    if (busy || !inp.trim() || status === 'won') return
    setBusy(true); setErr('')
    const { data, status: code } = await apiDemoAnswer(step.step, inp.trim())
    setBusy(false)
    if (data?.correct) {
      setStatus('won')
      setTimeout(() => onSolved(step.step), 1400)
    } else if (code === 422) {
      setShake(true); setErr(t('demo_wrong')); setTimeout(() => setShake(false), 500)
    } else {
      setErr(t('demo_error') || t('demo_wrong'))
    }
  }

  return (
    <div style={{ width: 'min(94vw,440px)', background: PANEL, borderRadius: 22, padding: '20px 18px', border: '1.5px solid #ffffff14', boxShadow: '0 24px 60px #000a', animation: 'demoPop .4s cubic-bezier(.34,1.56,.64,1) both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ filter: status === 'won' ? 'none' : 'none', pointerEvents: 'none' }}>
          <Card card={step.card} />
        </div>

        {status === 'won' ? (
          <div style={{ textAlign: 'center', animation: 'demoPop .4s both' }}>
            <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 19, color: '#00cec9' }}>{t('demo_correct')}</div>
            <div style={{ fontSize: 13, color: '#cfe', marginTop: 4 }}>{cardName(step.card, lang)}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.5 }}>{question}</div>
            <div style={{ fontSize: 11, color: '#9bb0c8' }}>{t('demo_answer_hint').replace('{n}', wc)}</div>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                ref={inputRef}
                value={inp}
                onChange={e => { setInp(e.target.value); setErr('') }}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder={t('demo_answer_placeholder')}
                disabled={busy}
                style={{ flex: 1, background: '#ffffff12', border: shake ? '2px solid #e74c3c' : '2px solid #f9ca2444', color: '#fff', padding: '11px 13px', borderRadius: 11, fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 14, outline: 'none', animation: shake ? 'demoShake .45s' : 'none' }}
              />
              <button onClick={submit} disabled={busy || !inp.trim()} style={{ background: busy || !inp.trim() ? '#ffffff18' : 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: busy || !inp.trim() ? '#888' : '#1e3045', padding: '11px 18px', borderRadius: 11, fontWeight: 900, fontSize: 14, cursor: busy || !inp.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {busy ? '…' : t('demo_submit')}
              </button>
            </div>
            {err && <div style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700 }}>{err}</div>}
          </>
        )}
      </div>
    </div>
  )
}

// ── Mur d'inscription (conversion du compte anonyme) ──────────────────────────
function SignupWall({ auth, onOpenAuth, earned, t }) {
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
    <div style={{ width: 'min(94vw,440px)', background: PANEL, borderRadius: 22, padding: '24px 20px', border: '1.5px solid #f9ca2433', boxShadow: '0 24px 60px #000a', animation: 'demoPop .4s both' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#f9ca24' }}>{t('demo_wall_title')}</div>
        <div style={{ fontSize: 13.5, color: '#bcd', lineHeight: 1.5, marginTop: 6 }}>{t('demo_wall_sub')}</div>
      </div>

      {/* Aperçu des 5 geocoins gagnés */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {earned.map(c => <div key={c.id} style={{ pointerEvents: 'none' }}><Card card={c} small /></div>)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <input value={pseudo} onChange={e => { setPseudo(e.target.value); setErr('') }} placeholder={t('demo_wall_pseudo')} maxLength={20}
          style={inputStyle} />
        <input value={email} onChange={e => { setEmail(e.target.value); setErr('') }} type="email" placeholder={t('demo_wall_email')}
          style={inputStyle} />
        <input value={password} onChange={e => { setPassword(e.target.value); setErr('') }} type="password" placeholder={t('demo_wall_password')}
          onKeyDown={e => { if (e.key === 'Enter') submit() }} style={inputStyle} />
        {err && <div style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ background: busy ? '#ffffff18' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: busy ? 'default' : 'pointer', marginTop: 4 }}>
          {busy ? '…' : t('demo_wall_cta')}
        </button>
        <button onClick={onOpenAuth} style={{ background: 'none', border: 'none', color: '#9bb0c8', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}>
          {t('demo_wall_have_account')}
        </button>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', boxSizing: 'border-box', background: '#ffffff0f', border: '1.5px solid #ffffff22', borderRadius: 11, color: '#fff', padding: '12px 14px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 15, outline: 'none' }
