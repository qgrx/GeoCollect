import { useState, useEffect } from 'react'
import { useT } from '../../i18n/translations.js'
import { apiGetGeocaching, apiVerifyGeocaching } from '../../services/api.js'
import GeocachingBadge from '../../components/GeocachingBadge.jsx'

/**
 * Panneau « Ma photo de profil geocaching.com » (= vérification), affiché dans
 * sa propre popup (GeocachingModal).
 * 1. Le joueur copie l'extrait (avec son lien de parrainage) et le colle dans la
 *    section « À propos » de son profil geocaching.com.
 * 2. Il clique sur « Vérifier ». Le backend lit le profil geocaching dont le
 *    pseudo est IDENTIQUE à son pseudo geocoins (`gamePseudo`) et confirme le
 *    lien, puis importe la photo de profil comme avatar.
 *
 * Si aucun profil geocaching ne correspond au pseudo → on propose de changer de
 * pseudo (si autorisé, via `onRequestPseudoChange`).
 *
 * Props : theme, gamePseudo, canChangePseudo, onRequestPseudoChange,
 *         onVerified(res), onClose.
 */
const DARK = {
  title: '#f9ca24', desc: '#cfdae6', label: '#9fb2c4',
  inputBg: '#ffffff10', inputBorder: '#ffffff22', inputText: '#fff', track: '#ffffff14',
}

// Points animés affichés pendant la lecture du profil geocaching (~quelques
// secondes) — rend l'attente plus agréable qu'un « … » figé.
function LoadingDots({ color = '#fff' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: '1em' }}>
      <style>{`@keyframes gcDot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}`}</style>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: color,
          display: 'inline-block', animation: `gcDot 1s ${i * 0.16}s infinite ease-in-out` }} />
      ))}
    </span>
  )
}

export function GeocachingPanel({ theme, gamePseudo = '', canChangePseudo = false, onRequestPseudoChange, onVerified }) {
  const { t } = useT()
  const [data, setData]     = useState(null)
  const [busy, setBusy]     = useState(false)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg]       = useState(null)   // { type: 'ok'|'err', text, noProfile? }

  const load = () => apiGetGeocaching().then(({ data }) => data && setData(data)).catch(() => {})
  useEffect(() => { let alive = true; apiGetGeocaching().then(({ data }) => { if (alive && data) setData(data) }).catch(() => {}); return () => { alive = false } }, [])

  if (!data) return null
  if (!data.enabled && !data.verified) return null

  const c = theme ? {
    title: theme.gold, desc: theme.textSecondary, label: theme.textMuted,
    inputBg: theme.bgInput, inputBorder: theme.border, inputText: theme.textPrimary, track: theme.overlayMd,
  } : DARK

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(data.snippet_html || data.snippet_text || '')
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papiers indisponible */ }
  }

  const verify = async () => {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const { data: res, error } = await apiVerifyGeocaching()
      if (error) { setMsg({ type: 'err', text: error }); return }
      if (res?.verified) {
        setMsg({ type: 'ok', text: t('gc_verify_success') })
        onVerified?.(res)
        await load()
      } else if (res?.reason === 'profile_not_found') {
        setMsg({ type: 'err', noProfile: true, text: t('gc_verify_no_profile').replace('{u}', res.pseudo || gamePseudo) })
      } else {
        setMsg({ type: 'err', text: t('gc_verify_not_found') })
      }
    } catch {
      setMsg({ type: 'err', text: t('gc_verify_error') })
    } finally {
      setBusy(false)
    }
  }

  const Title = () => (
    <div style={{ fontWeight: 900, fontSize: 15, color: c.title, marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 6 }}>
      <GeocachingBadge size={18} /> {t('gc_title')}
    </div>
  )

  // ── Déjà vérifié ──────────────────────────────────────────────────────────
  if (data.verified) {
    return (
      <div>
        <Title />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          color: '#17a86a', fontWeight: 800, marginBottom: 14 }}>
          <GeocachingBadge size={16} />
          {t('gc_verified_as').replace('{u}', data.username || '')}
        </div>

        {/* Ré-import : si le joueur change sa photo sur geocaching, il peut la
            réactualiser ici (le lien est déjà sur son profil). */}
        <div style={{ fontSize: 11.5, color: c.desc, marginBottom: 10, lineHeight: 1.5 }}>
          {t('gc_reimport_desc')}
        </div>
        <button onClick={verify} disabled={busy}
          style={{ width: '100%', background: 'linear-gradient(135deg,#02874D,#17a86a)', border: 'none',
            color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 900, fontSize: 13,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? .85 : 1, fontFamily: "'Nunito',sans-serif" }}>
          {busy ? <LoadingDots /> : `🔄 ${t('gc_reimport')}`}
        </button>

        {msg && (
          <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, lineHeight: 1.45,
            color: msg.type === 'ok' ? '#17a86a' : '#ff7675' }}>
            {msg.type === 'ok' ? '✅ ' : '⚠️ '}{msg.text}
          </div>
        )}
      </div>
    )
  }

  // ── À vérifier ────────────────────────────────────────────────────────────
  const okBtn = 'linear-gradient(135deg,#02874D,#17a86a)'
  return (
    <div>
      <Title />
      <div style={{ fontSize: 12, color: c.desc, marginBottom: 12, lineHeight: 1.5 }}>
        {t('gc_desc')}
      </div>

      {/* Étape 1 : extrait à copier */}
      <div style={{ fontSize: 10, color: c.label, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: .5, marginBottom: 6 }}>
        {t('gc_step1')}
      </div>
      <div style={{ background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 10,
        color: c.inputText, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45, marginBottom: 8,
        wordBreak: 'break-word' }}>
        {data.snippet_text}
      </div>
      <button onClick={copySnippet} style={{ width: '100%', background: 'linear-gradient(135deg,#00b894,#55efc4)',
        border: 'none', color: '#063', padding: '10px 16px', borderRadius: 10, whiteSpace: 'nowrap',
        fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", marginBottom: 16 }}>
        {copied ? '✅' : '📋'} {copied ? t('gc_copied') : t('gc_copy')}
      </button>
      <div style={{ fontSize: 11, color: c.label, fontStyle: 'italic', marginBottom: 16, marginTop: -8, lineHeight: 1.4 }}>
        💡 {t('gc_customize_hint')}
      </div>

      {/* Étape 2 : vérifier (utilise le pseudo du jeu) */}
      <div style={{ fontSize: 10, color: c.label, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: .5, marginBottom: 6 }}>
        {t('gc_step2')}
      </div>
      <div style={{ fontSize: 12, color: c.desc, marginBottom: 10, lineHeight: 1.5 }}>
        {t('gc_step2_info').replace('{u}', gamePseudo)}
      </div>
      <button onClick={verify} disabled={busy}
        style={{ width: '100%', background: okBtn, border: 'none', color: '#fff', padding: '11px 16px',
          borderRadius: 10, fontWeight: 900, fontSize: 13.5, cursor: busy ? 'default' : 'pointer',
          opacity: busy ? .85 : 1, fontFamily: "'Nunito',sans-serif" }}>
        {busy ? <LoadingDots /> : `🔍 ${t('gc_verify')}`}
      </button>

      {msg && (
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, lineHeight: 1.45,
          color: msg.type === 'ok' ? '#17a86a' : '#ff7675' }}>
          {msg.type === 'ok' ? '✅ ' : '⚠️ '}{msg.text}
          {msg.noProfile && (
            canChangePseudo ? (
              <button onClick={() => onRequestPseudoChange?.()} style={{ display: 'block', marginTop: 10,
                background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045',
                padding: '9px 16px', borderRadius: 10, fontWeight: 900, fontSize: 12.5, cursor: 'pointer',
                fontFamily: "'Nunito',sans-serif" }}>
                ✏️ {t('gc_change_pseudo')}
              </button>
            ) : (
              <div style={{ marginTop: 8, color: c.label, fontWeight: 700 }}>{t('gc_pseudo_locked_30d')}</div>
            )
          )}
        </div>
      )}
    </div>
  )
}

/** Popup autonome « Ma photo de profil geocaching.com ». */
export default function GeocachingModal({ onClose, ...panelProps }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 4000, backdropFilter: 'blur(8px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(145deg,#16213a,#0f172a)',
        borderRadius: 22, width: 'min(94vw,440px)', maxHeight: 'calc(100dvh - 100px)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', border: '1.5px solid #ffffff1f', boxShadow: '0 32px 80px #000b',
        fontFamily: "'Nunito',sans-serif", position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, background: '#000000aa',
          border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15,
          cursor: 'pointer', fontWeight: 900 }}>✕</button>
        <div style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch', padding: 22 }}>
          <GeocachingPanel {...panelProps} />
        </div>
      </div>
    </div>
  )
}
