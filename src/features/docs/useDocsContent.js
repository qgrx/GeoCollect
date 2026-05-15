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
      version: '🎉 v1.0 — Bienvenue dans la jungle des geocoins !',
      items: [
        { type: '🧠', text: 'Quiz en temps réel — Toutes les 60 secondes, un geocoin tombe du ciel. Une question apparaît. Le premier à répondre correctement l\'emporte. Le reste pleure. C\'est brutal, c\'est beau.' },
        { type: '🃏', text: 'Collection personnelle — Communs, rares, épiques, légendaires. Ils ont tous leurs couleurs, leurs images, et une valeur en points qui fait ou défait ton classement.' },
        { type: '✨', text: 'Geocoins Brillants (Shiny) — Posséder un geocoin c\'est bien. Le même avec un effet arc-en-ciel qui scintille, c\'est mieux. Forge tes shiny avec des points de forge.' },
        { type: '🔨', text: 'Forge & Quêtes quotidiennes — Complète des quêtes chaque jour pour gagner des points de forge. Rater une journée ? Le streak tombe. Dramatique.' },
        { type: '🏪', text: 'Marché entre joueurs — Tu as trois fois le même geocoin ? Vends-le. Achète celui qui te manque. L\'économie Geocoins ne repose que sur vous.' },
        { type: '🎁', text: 'Offre du jour — Un geocoin gratuit chaque jour. Juste comme ça. Parce qu\'on est sympas.' },
        { type: '💎', text: 'Packs Geocoins — Trois packs (3€ / 8€ / 15€), paiement CB ou Google Pay. Les geocoins arrivent instantanément. Sans abonnement, sans prise de tête.' },
        { type: '🌸', text: 'Saisons — Certains geocoins n\'existent que pendant une période définie. Rater une saison, c\'est rater ces geocoins pour toujours. Ou presque.' },
        { type: '🏆', text: 'Classement & Achievements — Un classement mondial, des achievements permanents et journaliers, des streaks de connexion. La fierté n\'a pas de prix, le score si.' },
        { type: '🌍', text: 'Multilingue — Français, English, Deutsch, Español. La géographie se parle dans toutes les langues.' },
        { type: '🌙', text: 'Mode sombre & clair — Tes yeux méritent le respect. Choisissez votre ambiance.' },
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
