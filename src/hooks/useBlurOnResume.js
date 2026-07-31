import { useEffect } from 'react'

// ── Focus fantôme au retour au premier plan (iOS) ────────────────────────────
// Quand l'app passe en arrière-plan (le joueur quitte la fenêtre de question pour
// aller chercher un code GC dans une autre app), le système referme le clavier
// virtuel MAIS le champ de saisie garde le focus DOM : `document.activeElement`
// pointe toujours dessus et aucun `blur` n'est émis.
//
// Au retour, taper dans ce champ ne déclenche donc AUCUN événement `focus` (il
// l'a déjà) → WebKit ne re-présente pas le clavier. Le joueur voit la fenêtre de
// réponse, le champ a l'air normal, mais il ne peut plus rien saisir tant qu'il
// n'a pas tapé ailleurs puis re-tapé dans le champ (ou rechargé l'app).
// Signalé par Arnokovic (iPhone, 31/07/2026, deux fois le même jour).
//
// On relâche donc ce focus fantôme dès le retour au premier plan : le tap suivant
// redevient un vrai focus et rouvre le clavier. On NE re-focalise PAS le champ —
// un `focus()` hors geste utilisateur n'ouvre pas le clavier sur iOS et recréerait
// exactement l'état fautif.
//
// Effet de bord utile : `useVisualViewport` déduit `keyboardOpen` d'un champ
// éditable focalisé (moteurs qui redimensionnent la mise en page) — le focus
// fantôme le laissait bloqué à `true`, ce qui escamotait indéfiniment tout ce qui
// est ancré en bas (bandeau de mise à jour, toasts d'achievement, notifs de vente).
//
// Limité au pointeur grossier (téléphone/tablette) : sur desktop il n'y a pas de
// clavier virtuel, et voler le focus d'un formulaire à chaque retour d'onglet
// serait une régression.
export default function useBlurOnResume() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia?.('(pointer: coarse)').matches) return
    const release = () => {
      if (document.visibilityState !== 'visible') return
      const el = document.activeElement
      if (!el) return
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true) el.blur()
    }
    document.addEventListener('visibilitychange', release)
    // Restauration depuis le bfcache (retour d'app / bouton précédent) : pas
    // toujours accompagnée d'un `visibilitychange`.
    window.addEventListener('pageshow', release)
    return () => {
      document.removeEventListener('visibilitychange', release)
      window.removeEventListener('pageshow', release)
    }
  }, [])
}
