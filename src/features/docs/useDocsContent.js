import { useState, useEffect, useCallback } from 'react'
import { apiGetDocsPage, apiSaveDocsPage } from '../../services/api.js'
import { useT } from '../../i18n/translations.js'

// Contenu de pré-remplissage (« seed ») utilisé uniquement pour amorcer une page
// encore vide côté serveur. JAMAIS affiché en cas d'erreur réseau : si la base est
// inaccessible, on préfère ne rien montrer plutôt qu'un texte périmé.
// NB : volontairement aucun seed pour « release-notes » — son contenu vit en base.
const DEFAULTS = {
  faq: [
    { q: 'Comment gagner des geocoins ?', a: "Répondez correctement aux quiz qui apparaissent régulièrement. Le premier joueur à donner la bonne réponse remporte un geocoin — et quand beaucoup de joueurs sont connectés, plusieurs geocoins identiques sont à gagner (2 dès 10 joueurs en ligne, 3 à 20, 4 à 30…), avec quelques secondes de plus pour décrocher le suivant. Vous pouvez aussi acheter des packs dans l'onglet Trésors." },
    { q: 'Comment fonctionne le quiz ?', a: "Un décompte s'affiche en bas de l'écran. Quand il atteint zéro, un geocoin est disponible. Cliquez sur « Participer » et soyez le premier à donner la bonne réponse !" },
    { q: 'Les geocoins achetés sont-ils définitifs ?', a: "Oui, tous les geocoins achetés sont immédiatement ajoutés à votre collection et sauvegardés. Ils ne peuvent pas expirer ni être supprimés." },
    { q: 'Comment fonctionne le marché ?', a: "Vous pouvez vendre vos geocoins en double sur le marché et en acheter d'autres. Le prix est fixé librement par le vendeur." },
    { q: "Qu'est-ce qu'un geocoin brillant (shiny) ?", a: "Les geocoins brillants sont des versions rares de geocoins ordinaires, avec un effet visuel spécial. Ils s'obtiennent par forge en dépensant des points de forge." },
    { q: 'Comment obtenir des points de forge ?', a: "Les points de forge sont gagnés en complétant des quêtes quotidiennes. Ils permettent de forger des geocoins brillants dans l'atelier de forge." },
    { q: 'Mon paiement a été débité mais je n\'ai pas reçu mes geocoins', a: "Vérifiez votre collection — les geocoins sont crédités automatiquement après confirmation du paiement. Si le problème persiste au-delà de quelques minutes, contactez-nous à contact@geocoins.io en précisant la date et le montant." },
    { q: 'Comment supprimer mon compte ?', a: "Vous pouvez supprimer votre compte depuis Mon Compte → Supprimer mon compte. Cette action est irréversible." },
  ],
  // Règles du jeu — page publique. Les {{marqueurs}} sont remplacés à l'affichage
  // par les valeurs réglées en admin (cf. src/data/gameValues.js).
  rules: [
      {
          "icon": "🎯",
          "title": "Le principe en trois phrases",
          "body": "<p>Geocoins est un jeu de collection gratuit inspiré du <strong>geocaching</strong>. Chaque geocoin rend hommage à une géocache réelle : son code, son type, la personne qui l'a posée.</p><p>Régulièrement, un geocoin est mis en jeu et une question apparaît. Les joueurs connectés répondent en même temps, et les plus rapides le remportent.</p><p>Votre collection est sauvegardée sur votre compte et vous suit sur tous vos appareils. Rien n'expire, rien ne se perd.</p>"
      },
      {
          "icon": "⏱️",
          "title": "Comment se déroule une manche",
          "body": "<p>En bas de l'écran, un compte à rebours annonce le prochain geocoin — avec sa rareté, pour que vous sachiez si ça vaut le coup de vous préparer. Quand il atteint zéro, la question s'affiche : cliquez sur <strong>Participer</strong> et tapez votre réponse.</p><ul><li>La réponse est <strong>tolérante</strong> : accents, majuscules et ponctuation n'ont aucune importance. Les réponses en anglais, allemand et espagnol sont aussi acceptées.</li><li>Le nombre de mots et de lettres attendus vous est indiqué : c'est un indice.</li><li>Vous pouvez vous tromper et réessayer. Un très grand nombre d'essais rapides impose une courte attente, pour éviter le forçage au hasard.</li><li>Dès qu'il y a au moins <strong>{{joueurs_pour_plusieurs_geocoins}} joueurs</strong> en ligne, <strong>{{geocoins_multiples_a_ce_palier}} geocoins identiques</strong> sont mis en jeu au lieu d'un seul — et plus il y a de monde, plus il y en a. Après le premier gagnant, les autres ont <strong>{{fenetre_geocoins_suivants}}</strong> pour décrocher le suivant.</li></ul><p>Plus il y a de joueurs connectés, plus les manches s'enchaînent vite. Le jeu s'anime tout seul quand vous êtes nombreux.</p>"
      },
      {
          "icon": "💎",
          "title": "Les raretés",
          "body": "<p>Chaque geocoin appartient à l'une des quatre raretés. Plus c'est rare, plus c'est difficile à croiser :</p><ul><li><strong>Commun</strong> — {{chance_commun}} des manches</li><li><strong>Rare</strong> — {{chance_rare}}</li><li><strong>Épique</strong> — {{chance_epique}}</li><li><strong>Légendaire</strong> — {{chance_legendaire}}</li></ul><p>La rareté détermine aussi le nombre de points que le geocoin rapporte à votre score, ce qu'il vaut à la revente, et ce qu'il coûte à la forge.</p>"
      },
      {
          "icon": "✨",
          "title": "Les geocoins brillants",
          "body": "<p>Environ <strong>{{chance_brillant}}</strong> des manches mettent en jeu une version <strong>brillante</strong> du geocoin. C'est le même objet dans une version scintillante, bien plus prestigieuse — et qui compte séparément dans votre collection : vous pouvez posséder les deux.</p><p>Un brillant vaut le double de points d'un geocoin normal. On peut aussi en fabriquer à la forge, mais il faut d'abord posséder la version normale.</p><p><strong>À savoir</strong> : gagner un brillant consomme l'un de vos geocoins du jour, comme un geocoin normal. Il n'est pas « en plus ».</p>"
      },
      {
          "icon": "📅",
          "title": "Vos limites quotidiennes",
          "body": "<p>Pour que le jeu reste un plaisir quotidien plutôt qu'une course d'endurance, vos gains sont bornés :</p><ul><li><strong>{{geocoins_par_jour}} geocoins par jour</strong>, et au maximum {{geocoins_par_heure}} par heure</li><li><strong>{{brillants_par_jour}} brillants par jour</strong></li><li><strong>{{or_par_jour}} pièces d'or par jour</strong></li><li>Par semaine : {{plafond_rare_par_semaine}} rares, {{plafond_epique_par_semaine}} épiques et {{plafond_legendaire_par_semaine}} légendaire</li></ul><p>Tout se réinitialise à <strong>minuit, heure de Paris</strong> — et les compteurs hebdomadaires le lundi.</p><p>Ces limites peuvent être repoussées : voir « Agrandir son sac » plus bas.</p>"
      },
      {
          "icon": "🏅",
          "title": "Quand vous avez atteint votre maximum",
          "body": "<p>Une bonne réponse n'est jamais perdue, même une fois vos limites atteintes. Selon la situation, il se passe l'une de ces trois choses :</p><ul><li><strong>La gloire</strong> — vous êtes affiché comme gagnant et vous encaissez vos pièces d'or ainsi que {{forge_de_consolation}} point de forge, mais le geocoin reste en jeu pour les autres. C'est la situation la plus fréquente.</li><li><strong>Le dépôt d'attente</strong> — s'il s'agit d'un geocoin précieux (épique, légendaire ou brillant), on vous propose de le mettre de côté pour le récupérer <strong>le lendemain</strong>, plutôt que de le laisser filer.</li><li><strong>Le mécénat</strong> — si vous avez atteint votre plafond hebdomadaire d'une rareté, vous pouvez <strong>offrir</strong> le geocoin à un autre joueur. Vous choisissez un critère (un nouveau, un fidèle, une petite collection…), le jeu désigne le bénéficiaire, et vous recevez des points de forge.</li></ul><p>Le dépôt dispose d'emplacements permanents à acheter ({{prix_emplacements_depot}} pièces d'or) ou d'une location ponctuelle à {{prix_location_depot}} pièces.</p>"
      },
      {
          "icon": "🔨",
          "title": "La forge et les points de forge",
          "body": "<p>Les <strong>points de forge</strong> sont la seconde monnaie du jeu. Ils s'obtiennent en jouant : {{forge_de_consolation}} point à chaque victoire au-delà de vos limites (jusqu'à {{forge_par_jour}} par jour), en validant des quêtes, en offrant des geocoins, et surtout en <strong>fondant vos doublons</strong>.</p><p>Fondre un geocoin en double rapporte {{gain_fonte}} points de forge. Un doublon brillant en rapporte {{gain_fonte_brillant}}.</p><p>Ces points servent à :</p><ul><li><strong>Rendre un geocoin brillant</strong> — {{prix_brillance}} points</li><li><strong>Forger un geocoin exclusif</strong> — certains geocoins ne s'obtiennent qu'ainsi, jamais au quiz : {{prix_forge}} points</li><li><strong>Acheter des geocoins hors saison</strong>, et agrandir votre sac à brillants</li></ul>"
      },
      {
          "icon": "🛒",
          "title": "Le marché",
          "body": "<p>Le marché permet d'échanger des geocoins avec les autres joueurs. Vous ne pouvez mettre en vente que vos <strong>doublons</strong> : votre collection n'est jamais entamée.</p><ul><li>Publier une annonce coûte {{frais_mise_en_vente}} pièces d'or, et la vente est taxée de {{taxe_de_vente}}.</li><li>Vous pouvez avoir jusqu'à {{annonces_maximum}} annonces en ligne.</li><li>Les prix sont libres, entre un plancher et un plafond calculés sur les ventes récentes — de quoi éviter les prix absurdes.</li><li>Une annonce qui ne trouve pas preneur vous est rendue au bout de quelques jours.</li></ul><p>Un <strong>marché hors saison</strong> propose par ailleurs les geocoins des saisons passées, vendus par le jeu contre des pièces d'or et des points de forge.</p>"
      },
      {
          "icon": "🎁",
          "title": "Trésor du jour, quêtes et saisons",
          "body": "<p><strong>Le trésor quotidien</strong> : un geocoin offert chaque jour, le même pour tout le monde, plus {{or_du_tresor}} pièces d'or. Une seule réclamation par jour.</p><p><strong>Les quêtes</strong> : trois objectifs par jour et trois par semaine, tirés au hasard — gagner des manches, vendre, fondre, se connecter… Elles rapportent des pièces d'or et des points de forge. Si l'une ne vous convient pas, vous pouvez en <strong>remplacer une par jour</strong>.</p><p><strong>Les saisons</strong> : certains geocoins ne sont mis en jeu que pendant leur saison. Hors période, ils restent accessibles au marché hors saison.</p>"
      },
      {
          "icon": "🔥",
          "title": "Les séries",
          "body": "<p>Deux séries différentes sont suivies :</p><ul><li><strong>Être « en feu »</strong> — enchaîner les manches en figurant parmi les premiers à répondre juste. À partir de <strong>{{serie_pour_etre_en_feu}} manches</strong> d'affilée, une flamme s'affiche à côté de votre nom. En contrepartie, un léger délai vous est imposé au départ des manches suivantes : un cadeau aux autres joueurs. Il ne s'applique jamais sur un geocoin que vous ne possédez pas encore.</li><li><strong>La fidélité</strong> — le nombre de jours consécutifs où vous avez gagné au moins un geocoin. Votre record est conservé, même si la série s'arrête.</li></ul>"
      },
      {
          "icon": "🎒",
          "title": "Agrandir son sac",
          "body": "<p>Vos limites quotidiennes ne sont pas gravées dans le marbre. Avec vos pièces d'or et vos points de forge, vous pouvez les repousser durablement :</p><ul><li><strong>Emplacements de sac</strong> — +1 geocoin par jour chacun, pour {{prix_emplacements_sac}} pièces d'or</li><li><strong>Sac à brillants</strong> — +1 brillant par jour chacun, pour {{prix_emplacements_sac_brillant}} points de forge</li><li><strong>Agrandir ses poches</strong> — +{{geocoins_boost_poches}} geocoins par heure jusqu'à minuit, pour {{prix_boost_poches}} pièces d'or, cumulable dans la journée</li></ul>"
      },
      {
          "icon": "🎓",
          "title": "Le mode Entraînement",
          "body": "<p>À côté des manches classiques, une piste <strong>Entraînement</strong> tourne en permanence. Les manches durent {{duree_manche_entrainement}} et, surtout, <strong>tout le monde peut gagner</strong> : il n'y a pas de course, chaque bonne réponse compte.</p><p>Seuls des geocoins communs y sont mis en jeu, et les cinq plus rapides reçoivent un peu d'or. La bonne réponse est révélée à la fin de chaque manche : c'est le meilleur endroit pour apprendre.</p><p>À noter : gagner d'un côté vous met brièvement en pause de l'autre. On ne joue pas les deux pistes exactement en même temps.</p>"
      },
      {
          "icon": "🏆",
          "title": "Score, rangs et classement",
          "body": "<p>Votre score est la somme des points de tous les geocoins <strong>différents</strong> que vous possédez — les doublons ne comptent pas. Plus un geocoin est rare, plus il rapporte, et une version brillante vaut le double de la normale.</p><p>Le score détermine votre rang, du plus modeste au plus prestigieux, et votre place au classement général.</p>"
      },
      {
          "icon": "🤝",
          "title": "Parrainage et profil geocaching",
          "body": "<p><strong>Parrainez vos amis</strong> : partagez votre lien personnel. Dès qu'un filleul atteint {{geocoins_pour_valider_un_filleul}} geocoins différents, il compte pour votre récompense de parrain. Le lien ne fonctionne qu'avec de nouveaux joueurs.</p><p><strong>Vérifiez votre profil geocaching.com</strong> : collez votre lien de parrainage dans la section « À propos » de votre profil, et le jeu confirmera qu'il vous appartient. Vous récupérez votre photo de profil et un badge de vérification. Votre pseudo doit être identique des deux côtés — et il sera ensuite verrouillé.</p>"
      },
      {
          "icon": "💡",
          "title": "Quelques conseils pour bien démarrer",
          "body": "<ul><li><strong>Ne vous précipitez pas sur tout.</strong> Vos geocoins du jour sont comptés : mieux vaut les réserver aux raretés et laisser passer les communs que vous possédez déjà.</li><li><strong>Fondez vos doublons.</strong> C'est la principale source de points de forge, et elle n'a aucune limite.</li><li><strong>Ou vendez-les.</strong> Un doublon vendu finance l'achat d'un geocoin qui vous manque vraiment.</li><li><strong>Passez par l'Entraînement</strong> pour apprendre les réponses sans pression : les questions reviennent dans les manches classiques.</li><li><strong>Pensez au dépôt</strong> avant de laisser filer un épique ou un légendaire hors limite. Un emplacement acheté est vite rentabilisé.</li><li><strong>Le brillant est un objectif de longue haleine</strong>, pas une case à cocher la première semaine. Choisissez les geocoins qui vous tiennent à cœur.</li></ul>"
      }
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
  const { lang } = useT()
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
    setDirty(false)
    apiGetDocsPage(page, lang)
      .then(({ data, error }) => {
        if (!alive) return
        // `api_not_configured` = mode local (dev sans backend) : on retombe sur le seed.
        // Toute autre erreur = base réellement inaccessible : on n'affiche RIEN de périmé.
        if (error && error !== 'api_not_configured') { setError(error); return }
        // Contenu en base (langue courante ou repli FR côté serveur) → source de vérité.
        // Tolérance : un backend pas encore à jour peut renvoyer la map { fr, en… }
        // entière au lieu du tableau d'une langue → on extrait nous-mêmes la langue.
        let c = data?.content
        if (c && !Array.isArray(c) && typeof c === 'object') c = c[lang] ?? c.fr ?? null
        const initial = c ?? DEFAULTS[page] ?? []
        setContent(withIds(initial))
      })
      .catch(() => { if (alive) setError('network') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, lang])

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

  // `override` permet d'enregistrer un contenu précis (ex. après avoir tamponné une
  // release) sans dépendre du state encore non propagé après un update().
  const save = useCallback(async (override) => {
    const toSave = override ?? content
    setSaving(true)
    setSaveError(false)
    const { error } = await apiSaveDocsPage(page, toSave, lang).catch(() => ({ error: 'network' }))
    setSaving(false)
    if (error) { setSaveError(true); return false }
    setDirty(false)
    return true
  }, [page, content, lang])

  return { content, update, save, reset, loading, saving, dirty, error, saveError, uid }
}
