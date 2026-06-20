/* global __COMMIT_SHA__ */
/**
 * Détection de nouvelle version déployée.
 *
 * Au build, vite émet /version.json (= SHA du build, cf. vite.config.js) et
 * injecte ce même SHA dans le bundle (__COMMIT_SHA__). La SPA en cours sonde
 * périodiquement /version.json : si le SHA en ligne diffère de celui qu'elle
 * exécute, c'est qu'un nouveau déploiement est disponible → on propose de
 * rafraîchir. Le service worker est « réseau d'abord », donc un reload récupère
 * bien les nouveaux assets.
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/translations.js'

const CURRENT = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev'
const POLL_MS = 60_000

export default function UpdateBanner() {
  const { t } = useT()
  const [stale, setStale] = useState(false)
  const stopped = useRef(false)

  useEffect(() => {
    // Pas de détection en dev (pas de /version.json servi) ni si le SHA est inconnu.
    if (import.meta.env.DEV || CURRENT === 'unknown' || CURRENT === 'dev') return

    const check = async () => {
      if (stopped.current || document.hidden) return
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { version } = await r.json()
        if (version && version !== CURRENT) {
          stopped.current = true
          setStale(true)
        }
      } catch { /* hors-ligne / pas encore déployé : on ignore */ }
    }

    const timer = setInterval(check, POLL_MS)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    check() // vérification initiale

    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!stale) return null

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 6000, display: 'flex', justifyContent: 'center', padding: '10px 12px', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', color: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 12px 40px #0008', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13.5, maxWidth: 'min(92vw,460px)' }}>
        <span>🔄 {t('update_available')}</span>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#fff', color: '#4a36c7', border: 'none', borderRadius: 10, padding: '7px 14px', fontWeight: 900, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {t('update_refresh')}
        </button>
      </div>
    </div>
  )
}
