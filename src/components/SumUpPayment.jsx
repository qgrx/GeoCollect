import { useEffect, useRef } from 'react'

/**
 * Widget de paiement SumUp embarqué.
 * Nécessite https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js dans index.html.
 * https://developer.sumup.com/online-payments/checkouts/card-widget
 */
export default function SumUpPayment({ checkoutId, onSuccess, onError, onClose }) {
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!checkoutId || !window.SumUpCard) return

    // mount() retourne une instance avec unmount()
    const googleMerchantId   = import.meta.env.VITE_GOOGLE_MERCHANT_ID || 'BCR2DN5TRPGONUL3'
    const googleMerchantName = import.meta.env.VITE_GOOGLE_MERCHANT_NAME || 'Geocoins'

    widgetRef.current = window.SumUpCard.mount({
      id:         'sumup-card',
      checkoutId,
      googlePay: { merchantId: googleMerchantId, merchantName: googleMerchantName, environment: 'TEST' },
      onResponse: (type, body) => {
        console.log('[SumUp] response:', type, body)
        if (type === 'success') {
          onSuccess?.()
        } else if (type === 'fail' || type === 'error') {
          onError?.(body?.message || 'Paiement non abouti.')
        }
        // 'sent', 'invalid', 'auth-screen' → états intermédiaires, on attend
      },
    })

    return () => {
      try { widgetRef.current?.unmount?.() } catch {}
      widgetRef.current = null
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
