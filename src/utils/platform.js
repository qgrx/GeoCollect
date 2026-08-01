// Détection iOS/iPadOS (WebKit mobile). Utilisée pour les contournements de
// comportements PROPRES à WebKit — pas pour de la mise en page, où l'on préfère
// toujours une détection par capacité (pointeur grossier, visualViewport).
//
// iPadOS ≥ 13 se déclare « MacIntel » : on le distingue d'un vrai Mac par la
// présence d'un écran tactile.
// Pointeur grossier = téléphone/tablette, donc clavier VIRTUEL : c'est là que
// donner le focus par programme est risqué (le clavier ne suit pas le focus).
export function isTouchDevice() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1
}
