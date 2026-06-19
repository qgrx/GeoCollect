import { useState, useEffect, useCallback } from 'react'
import { apiGetDocsPage, apiSaveDocsPage } from '../../services/api.js'

// Contenu de pré-remplissage (« seed ») utilisé uniquement pour amorcer une page
// encore vide côté serveur. JAMAIS affiché en cas d'erreur réseau : si la base est
// inaccessible, on préfère ne rien montrer plutôt qu'un texte périmé.
// NB : volontairement aucun seed pour « release-notes » — son contenu vit en base.
const DEFAULTS = {
  faq: [
    { q: 'Comment gagner des geocoins ?', a: "Répondez correctement aux quiz qui apparaissent toutes les 60 secondes. Le premier joueur à donner la bonne réponse remporte le geocoin en jeu. Vous pouvez aussi acheter des packs dans l'onglet Trésors." },
    { q: 'Comment fonctionne le quiz ?', a: "Un décompte s'affiche en bas de l'écran. Quand il atteint zéro, un geocoin est disponible. Cliquez sur « Participer » et soyez le premier à donner la bonne réponse !" },
    { q: 'Les geocoins achetés sont-ils définitifs ?', a: "Oui, tous les geocoins achetés sont immédiatement ajoutés à votre collection et sauvegardés. Ils ne peuvent pas expirer ni être supprimés." },
    { q: 'Comment fonctionne le marché ?', a: "Vous pouvez vendre vos geocoins en double sur le marché et en acheter d'autres. Le prix est fixé librement par le vendeur." },
    { q: "Qu'est-ce qu'un geocoin brillant (shiny) ?", a: "Les geocoins brillants sont des versions rares de geocoins ordinaires, avec un effet visuel spécial. Ils s'obtiennent par forge en dépensant des points de forge." },
    { q: 'Comment obtenir des points de forge ?', a: "Les points de forge sont gagnés en complétant des quêtes quotidiennes. Ils permettent de forger des geocoins brillants dans l'atelier de forge." },
    { q: 'Mon paiement a été débité mais je n\'ai pas reçu mes geocoins', a: "Vérifiez votre collection — les geocoins sont crédités automatiquement après confirmation du paiement. Si le problème persiste au-delà de quelques minutes, contactez-nous à contact@geocoins.fr en précisant la date et le montant." },
    { q: 'Comment supprimer mon compte ?', a: "Vous pouvez supprimer votre compte depuis Mon Compte → Supprimer mon compte. Cette action est irréversible." },
  ],
  support: [
    { icon: '💳', title: 'Problème de paiement', desc: 'Pack acheté non crédité, double débit ou remboursement — précisez le montant et la date.' },
    { icon: '🔐', title: 'Problème de compte', desc: 'Connexion impossible, mot de passe oublié, compte bloqué ou supprimé par erreur.' },
    { icon: '💡', title: 'Suggestion ou amélioration', desc: 'Une idée pour améliorer Geocoins ? Partagez-la, toutes les suggestions sont lues.' },
  ],
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`)

// Garantit un `id` stable sur chaque entrée (et chaque sous-item) afin de pouvoir
// l'utiliser comme clé React : sans ça, les réorganisations (↑/↓) et insertions
// décalent les index et corrompent l'édition (notes perdues / non rafraîchies).
function withIds(list) {
  if (!Array.isArray(list)) return []
  return list.map(entry => ({
    ...entry,
    id: entry.id ?? uid(),
    ...(Array.isArray(entry.items)
      ? { items: entry.items.map(it => ({ ...it, id: it.id ?? uid() })) }
      : {}),
  }))
}

export function useDocsContent(page) {
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)
  const [error,   setError]   = useState(null)   // erreur de chargement
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    apiGetDocsPage(page)
      .then(({ data, error }) => {
        if (!alive) return
        // `api_not_configured` = mode local (dev sans backend) : on retombe sur le seed.
        // Toute autre erreur = base réellement inaccessible : on n'affiche RIEN de périmé.
        if (error && error !== 'api_not_configured') { setError(error); return }
        // Contenu en base → source de vérité. Sinon, seed local (jamais pour release-notes).
        const initial = data?.content ?? DEFAULTS[page] ?? []
        setContent(withIds(initial))
      })
      .catch(() => { if (alive) setError('network') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page])

  const update = useCallback((newContent) => {
    setContent(newContent)
    setDirty(true)
    setSaveError(false)
  }, [])

  const reset = useCallback(() => {
    setContent(withIds(DEFAULTS[page] ?? []))
    setDirty(true)
    setSaveError(false)
  }, [page])

  const save = useCallback(async () => {
    setSaving(true)
    setSaveError(false)
    const { error } = await apiSaveDocsPage(page, content).catch(() => ({ error: 'network' }))
    setSaving(false)
    if (error) { setSaveError(true); return false }
    setDirty(false)
    return true
  }, [page, content])

  return { content, update, save, reset, loading, saving, dirty, error, saveError, uid }
}
