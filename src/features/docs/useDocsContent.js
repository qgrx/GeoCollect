import { useState, useEffect } from 'react'
import { apiGetDocsPage, apiSaveDocsPage } from '../../services/api.js'

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
  'release-notes': [
    {
      version: 'v2.5 — Mai 2026',
      items: [
        { type: '✨', text: 'Packs Geocoins — achetez des geocoins via Google Pay, Apple Pay ou CB' },
        { type: '✨', text: 'Geocoins de saison — des geocoins disponibles uniquement pendant une période définie' },
        { type: '✨', text: 'Nouveau décompte avant chaque quiz avec effet de mèche lumineux' },
        { type: '🔧', text: 'Correction de l\'horloge au rechargement de page pendant un décompte' },
      ],
    },
    {
      version: 'v2.4 — Avril 2026',
      items: [
        { type: '✨', text: 'Page Trésors — offre quotidienne gratuite + boutique packs' },
        { type: '✨', text: 'Système de forge brillante — transformez vos geocoins en version shiny' },
        { type: '🔧', text: 'Amélioration des performances du marché' },
      ],
    },
  ],
  support: [
    { icon: '💳', title: 'Problème de paiement', desc: 'Pack acheté non crédité, double débit ou remboursement — précisez le montant et la date.' },
    { icon: '🔐', title: 'Problème de compte', desc: 'Connexion impossible, mot de passe oublié, compte bloqué ou supprimé par erreur.' },
    { icon: '💡', title: 'Suggestion ou amélioration', desc: 'Une idée pour améliorer Geocoins ? Partagez-la, toutes les suggestions sont lues.' },
  ],
}

export function useDocsContent(page) {
  const [content, setContent] = useState(DEFAULTS[page] || [])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)

  useEffect(() => {
    apiGetDocsPage(page).then(({ data }) => {
      if (data?.content) setContent(data.content)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [page])

  function update(newContent) { setContent(newContent); setDirty(true) }

  async function save() {
    setSaving(true)
    await apiSaveDocsPage(page, content).catch(() => {})
    setSaving(false)
    setDirty(false)
  }

  return { content, update, save, loading, saving, dirty }
}
