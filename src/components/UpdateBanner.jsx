/* global __COMMIT_SHA__ */
/**
 * Détection de nouvelle version déployée.
 *
 * Quand /version.json diverge du SHA compilé dans le bundle, on attend 1 minute
 * (le backend se redéploie en même temps que le front), puis on sonde /health
 * toutes les 10 s jusqu'à ce qu'il réponde OK. Le bandeau n'apparaît qu'une fois
 * le backend stable — évite que l'utilisateur rafraîchisse en plein redémarrage.
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/translations.js'

const CURRENT           = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev'
const POLL_MS           = 60_000   // intervalle de vérification du frontend
const BACKEND_WAIT_MS   = 60_000   // délai après détection avant de sonder le backend
const HEALTH_TICK_MS    = 10_000   // intervalle entre deux sondes /health
const HEALTH_TIMEOUT_MS = 3 * 60_000  // on affiche le bandeau quoi qu'il arrive après ce délai

const _rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const API_URL    = _rawApiUrl || 'http://localhost:3001'

export default function UpdateBanner() {
  const { t } = useT()
  const [ready, setReady] = useState(false)
  const updateDetected = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV || CURRENT === 'unknown' || CURRENT === 'dev') return

    let cancelled  = false
    let waitTimer  = null
    let pollTimer  = null

    async function pollBackendHealth() {
      const deadline = Date.now() + HEALTH_TIMEOUT_MS

      async function tick() {
        if (cancelled) return

        if (Date.now() >= deadline) { setReady(true); return }

        try {
          const r = await fetch(`${API_URL}/health?t=${Date.now()}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5_000),
          })
          if (r.ok) { if (!cancelled) setReady(true); return }
        } catch { /* backend encore en cours de démarrage — on réessaie */ }

        if (!cancelled) pollTimer = setTimeout(tick, HEALTH_TICK_MS)
      }

      tick()
    }

    function onUpdateDetected() {
      // Pas d'URL API configurée → pas de backend à attendre
      if (!_rawApiUrl) { setReady(true); return }
      waitTimer = setTimeout(pollBackendHealth, BACKEND_WAIT_MS)
    }

    const checkFrontend = async () => {
      if (updateDetected.current || document.hidden) return
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { version } = await r.json()
        if (version && version !== CURRENT) {
          updateDetected.current = true
          onUpdateDetected()
        }
      } catch { /* hors-ligne : on ignore */ }
    }

    const timer    = setInterval(checkFrontend, POLL_MS)
    const onVisible = () => { if (!document.hidden) checkFrontend() }
    document.addEventListener('visibilitychange', onVisible)
    checkFrontend()

    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(waitTimer)
      clearTimeout(pollTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!ready) return null

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
