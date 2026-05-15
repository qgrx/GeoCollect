import { useEffect, useRef } from 'react'

/**
 * Widget de paiement SumUp embarqué.
 * Nécessite https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js dans index.html.
 */
export default function SumUpPayment({ checkoutId, onSuccess, onError, onClose }) {
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current || !checkoutId || !window.SumUpCard) return
    mounted.current = true

    window.SumUpCard.mount({
      id:         'sumup-card',
      checkoutId,
      onResponse: (type, body) => {
        console.log('[SumUp] response:', type, body)
        if (type === 'sent' && body?.status === 'PAID') {
          onSuccess?.()
        } else if (type === 'error' || (type === 'sent' && body?.status !== 'PAID')) {
          onError?.(body?.message || 'Paiement non abouti.')
        }
      },
    })

    return () => {
      // Nettoyer le widget si l'API le permet
      try { window.SumUpCard?.unmount?.() } catch {}
    }
  }, [checkoutId])

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#000c', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div id="sumup-card" style={{ width: 'min(96vw,420px)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px #000c' }} />
      <button onClick={onClose}
        style={{ background: '#ffffff18', border: '1px solid #ffffff22', color: '#aaa', padding: '8px 20px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
        Annuler
      </button>
    </div>
  )
}
