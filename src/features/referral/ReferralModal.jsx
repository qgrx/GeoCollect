import { useState, useEffect } from 'react'
import { useT } from '../../i18n/translations.js'
import { apiGetReferral } from '../../services/api.js'

/**
 * Panneau de parrainage réutilisable (réglages, détail du geocoin, menu joueur).
 * Charge ses propres données via /api/referral/me : lien partageable + filleuls.
 * Style sombre neutre, lisible dans tous les modaux (tous sur fond foncé).
 */
export function ReferralPanel({ showTitle = true }) {
  const { t } = useT()
  const [ref, setRef]       = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    apiGetReferral().then(({ data }) => { if (alive && data) setRef(data) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!ref?.url) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papiers indisponible */ }
  }

  const filleuls = ref.filleuls || []

  return (
    <div>
      {showTitle && (
        <div style={{ fontWeight: 900, fontSize: 14, color: '#f9ca24', marginBottom: 6 }}>
          🤝 {t('referral_title')}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#9fb2c4', marginBottom: 10, lineHeight: 1.5 }}>
        {t('referral_desc').replace('{m}', ref.min_geocoins)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input readOnly value={ref.url} onFocus={e => e.target.select()}
          style={{ flex: 1, minWidth: 0, background: '#ffffff10', border: '1px solid #ffffff22',
            borderRadius: 10, color: '#fff', padding: '9px 12px', fontSize: 12,
            fontFamily: "'Nunito',sans-serif" }}/>
        <button onClick={copy} style={{ background: 'linear-gradient(135deg,#00b894,#55efc4)',
          border: 'none', color: '#063', padding: '0 16px', borderRadius: 10, whiteSpace: 'nowrap',
          fontWeight: 900, fontSize: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
          {copied ? '✅' : '📋'} {copied ? t('referral_copied') : t('referral_copy')}
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#8095a8', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: .5, marginBottom: 8 }}>
        {t('referral_godchildren')} ({ref.qualified_count}/{ref.required_count})
      </div>

      {filleuls.length === 0 ? (
        <div style={{ fontSize: 12, color: '#778899', fontStyle: 'italic' }}>{t('referral_no_godchildren')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filleuls.map((f, i) => {
            const pct = Math.min(100, Math.round((f.geocoins / ref.min_geocoins) * 100))
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#cfdae6', fontWeight: 700 }}>
                    {f.qualified ? '✅ ' : ''}{t('referral_godchild')} {i + 1} · {f.pseudo}
                  </span>
                  <span style={{ color: f.qualified ? '#00b894' : '#9fb2c4', fontWeight: 800 }}>
                    {Math.min(f.geocoins, ref.min_geocoins)} / {ref.min_geocoins}
                  </span>
                </div>
                <div style={{ background: '#ffffff14', borderRadius: 50, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50,
                    background: f.qualified ? '#00b894' : 'linear-gradient(90deg,#f9ca24,#e17055)',
                    transition: 'width .5s' }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Modal autonome ouvert depuis le menu du joueur. */
export default function ReferralModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(8px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(145deg,#16213a,#0f172a)',
        borderRadius: 22, width: 'min(94vw,440px)', maxHeight: '90vh', overflowY: 'auto',
        border: '1.5px solid #ffffff1f', boxShadow: '0 32px 80px #000b', padding: 22,
        fontFamily: "'Nunito',sans-serif", position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: '#00000044',
          border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 15,
          cursor: 'pointer', fontWeight: 900 }}>✕</button>
        <ReferralPanel />
      </div>
    </div>
  )
}
