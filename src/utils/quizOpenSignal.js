import { useSyncExternalStore } from 'react'

// Signal « une fenêtre de quiz est ouverte », partagé hors arbre React (la modale
// de quiz et le bandeau de mise à jour sont montés dans deux branches distinctes).
//
// Raison d'être : le bandeau de mise à jour est ancré en bas d'écran avec un
// z-index très au-dessus de la modale de quiz, et son bouton « Rafraîchir » tombe
// pile sur la ligne de saisie de la réponse — un tap raté RECHARGE l'app en plein
// round. Il était jusqu'ici escamoté par le seul `keyboardOpen`, ce qui ne couvre
// pas le joueur qui a la fenêtre de question ouverte sans le clavier (retour
// d'arrière-plan, lecture de la question avant de répondre).
let openCount = 0
const subscribers = new Set()

function notify() { subscribers.forEach(fn => fn()) }

// À appeler dans un effet : `useEffect(() => pushQuizOpen(), [])` — la fonction
// rendue décrémente au démontage.
export function pushQuizOpen() {
  openCount++
  notify()
  return () => { openCount = Math.max(0, openCount - 1); notify() }
}

export function useQuizOpen() {
  return useSyncExternalStore(
    fn => { subscribers.add(fn); return () => subscribers.delete(fn) },
    () => openCount > 0,
    () => false,
  )
}
