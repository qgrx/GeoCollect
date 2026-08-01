import { useState, useEffect } from 'react'
import { isIOS } from '../utils/platform.js'

// ── Zone RÉELLEMENT visible (visualViewport) ─────────────────────────────────
// `position:fixed` se cale sur le viewport de MISE EN PAGE, plus grand que la
// zone visible sur mobile : barre d'URL + barre d'outils Safari en haut/bas,
// clavier virtuel. Conséquences observées sur iPhone :
//   - un panneau centré sur `inset:0` a son haut sous la barre d'URL et son bas
//     sous la barre d'outils → titre et bouton ✕ inatteignables (le fond fixe
//     ne défile pas) ;
//   - un élément collé en bas (toast) remonte juste au-dessus du clavier et
//     masque le champ de saisie du quiz.
// Ce hook rend les valeurs nécessaires pour se recaler dessus (comme le fait
// déjà la modale de quiz) :
//   height/offsetTop : hauteur visible et décalage vertical, en px du viewport
//     de mise en page → `top:offsetTop; height:height` = pile la zone visible.
//   width            : largeur visible (suit les rotations/redimensionnements).
//   keyboardOpen     : clavier virtuel ouvert. Deux détections car les moteurs
//     réagissent différemment : amputation franche de la hauteur visible (iOS ;
//     seuil 150px, bien au-dessus des barres du navigateur ~50-120px), ou champ
//     éditable focalisé sur écran tactile (Android qui redimensionne la mise en
//     page : la hauteur visible ne bouge pas, l'amputation est invisible).
// Renvoie null si l'API n'est pas dispo (desktop ancien) : les appelants
// retombent alors sur leur mise en page classique.
export default function useVisualViewport() {
  const [vv, setVv] = useState(() => read(false))
  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return
    // `typing` est porté par une ref locale plutôt que par un state : les deux
    // sources (redimensionnement, focus) doivent recalculer le MÊME objet.
    let typing = isEditableFocused()
    // `resize`/`scroll` du visualViewport et les focus de n'importe quel bouton
    // sont fréquents : on ne remplace l'objet (⇒ re-rendu) que s'il a changé.
    const update = () => setVv(prev => {
      const next = read(typing)
      return same(prev, next) ? prev : next
    })
    const onFocusIn  = () => { typing = isEditableFocused(); update() }
    const onFocusOut = () => { typing = false; update() }
    // Retour au premier plan : le système a pu refermer le clavier pendant que la
    // page était GELÉE — le `resize` du visualViewport n'est alors jamais délivré et
    // on resterait sur une géométrie « clavier ouvert » (modale de quiz écrasée sur
    // le haut de l'écran, champ de réponse hors de la zone rendue). On relit donc
    // la zone visible à la reprise, puis une seconde fois en différé : iOS ne
    // stabilise ses valeurs qu'un instant APRÈS la reprise.
    let settleTimer = null
    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      typing = isEditableFocused(); update()
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => { typing = isEditableFocused(); update() }, 300)
    }
    update()
    visualViewport.addEventListener('resize', update)
    visualViewport.addEventListener('scroll', update)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    return () => {
      clearTimeout(settleTimer)
      visualViewport.removeEventListener('resize', update)
      visualViewport.removeEventListener('scroll', update)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
    }
  }, [])
  return vv
}

function read(typing) {
  if (typeof window === 'undefined' || !window.visualViewport) return null
  const { height, width, offsetTop } = window.visualViewport
  const shrunk = (window.innerHeight - height) > 150
  // iOS ampute TOUJOURS la zone visible quand le clavier s'ouvre : `shrunk` y fait
  // seule autorité. Le repli « champ focalisé » y serait même NUISIBLE — un champ
  // peut garder le focus DOM clavier fermé (cf. useBlurOnResume) et on annoncerait
  // alors un clavier ouvert qui n'existe pas (toast repositionné, notifications du
  // bas escamotées pour de bon). Le repli reste indispensable aux moteurs qui
  // redimensionnent la MISE EN PAGE (Android) : l'amputation y est invisible.
  const keyboardOpen = shrunk || (typing && isTouch() && !isIOS())
  return { height, width, offsetTop, keyboardOpen, keyboardShrunk: shrunk }
}

function same(a, b) {
  if (!a || !b) return a === b
  return a.height === b.height && a.width === b.width && a.offsetTop === b.offsetTop
    && a.keyboardOpen === b.keyboardOpen && a.keyboardShrunk === b.keyboardShrunk
}

function isEditableFocused() {
  const el = typeof document !== 'undefined' && document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

// Clavier virtuel : uniquement sur pointeur grossier (téléphone/tablette) — sur
// desktop un champ focalisé ne masque rien, le toast doit rester en bas.
function isTouch() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}
