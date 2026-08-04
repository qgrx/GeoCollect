# geocards (front) — Guide de travail

SPA React + Vite de **Geocoins**. Le backend est le repo voisin `geocards-api`,
qui porte aussi la documentation d'infrastructure.

## Commandes

```bash
npm run dev      # vite, http://localhost:5173
npm run lint     # eslint    ← doit passer avant tout push
npm run test     # vitest    ← doit passer avant tout push
npm run build    # vite build + pré-rendu SEO → dist/
node scripts/gen-icons.mjs   # régénère les icônes depuis assets/logo-pin.svg
```

Reproduire la CI avant de pousser : `npm run lint && npm run test && npm run build`.

**`.npmrc` porte `legacy-peer-deps=true`** — sans lui, `npm ci` échoue. Ne pas le
supprimer.

## Architecture

```
src/
  App.jsx          — composant racine
  hooks/
    useGameState.js  — état central du jeu
    useAuth.js       — session Supabase, OAuth
    useQuiz.js       — quiz + planning serveur
    useVisualViewport.js — à réutiliser pour TOUT overlay (cf. pièges iOS)
  routes.js        — table des routes + chemin ⇄ route (PUR, lu aussi par les scripts)
  hooks/useRoute.js  — route courante, navigation, popstate
  seo/             — site.js (domaine canonique), copy.js, jsonld.js, head.js
  features/        — un dossier par domaine (quiz, market, shop, admin…)
  components/      — composants réutilisables
  i18n/translations.js — 4 langues : fr / en / de / es
  services/, utils/, data/, lib/
scripts/
  gen-icons.mjs    — favicons, icônes PWA et og-image depuis assets/logo-pin.svg
  prerender.mjs    — pages publiques statiques + sitemap, après `vite build`
```

## SEO — pages publiques

Les URLs indexables sont de **vrais fichiers** dans `dist/`, générés au build :

```
/  /faq  /release-notes  /support  /geocoins/<id>-<slug>      (anglais, canonique)
/fr/…  /de/…  /es/…                                           (autres langues)
```

- **`src/routes.js` fait autorité** sur ce qui est une route valide. Y ajouter une
  page suffit à la faire connaître du client, du pré-rendu et du sitemap.
- **L'anglais est la langue par défaut** et n'a pas de préfixe ; le français en a
  un comme les autres. `SEO_LANGS[0]` dans `src/seo/site.js` est le seul endroit
  à changer — routes, hreflang, `x-default` et replis en découlent.
  Attention : le **français reste la langue de rédaction** (`SOURCE_LANG`), donc
  le dernier repli des traductions et des textes de cartes.
- La langue affichée suit : préfixe d'URL > `localStorage` > navigateur.
- **`vercel.json` n'a plus de réécriture attrape-tout.** C'est elle qui faisait
  répondre 200 à n'importe quelle URL (soft 404). Les adresses inconnues tombent
  désormais sur `public/404.html` avec un vrai statut 404. Une nouvelle route non
  pré-rendue doit donc être ajoutée aux `rewrites`.
- **Le domaine canonique est `geocoins.io`** (`src/seo/site.js`), jamais
  `window.location.origin` : `.fr` sert le même site et se ferait déclarer canonique.
- **Le contenu éditorial de ces pages est une PHOTO prise au build.** Publier une
  note de version, une entrée de FAQ ou une description de geocoin depuis l'admin
  ne change que la base : le fichier `dist/` servi aux crawlers garde l'ancien
  texte **et ses `og:*`**, alors que le visiteur avec JS voit la nouvelle version.
  D'où l'aperçu Discord annonçant une note périmée (04/08). L'API rappelle le
  build via un Deploy Hook Vercel après un `PATCH /api/docs/:page`
  (`VERCEL_DEPLOY_HOOK_URL`, cf. `services/frontendRebuild.js` côté API) ; les
  fiches geocoin, elles, attendent toujours un déploiement.
- **`npm run build` interroge l'API** (`VITE_API_URL`). API injoignable = pages
  publiées sans contenu éditorial, avec avertissement — le build ne casse pas.
  `scripts/prerender.mjs` **n'est pas rejouable seul** : il consomme la coquille
  `dist/index.html`, que seul `vite build` régénère.
- **Seuls les geocoins de type `Hommages` ont une page publique**
  (`PUBLISHED_TYPES` dans `features/geocoins/publicGeocoins.js`). C'est une liste
  BLANCHE : un nouveau type ne doit pas se retrouver publié par inadvertance. Les
  pays et les chasseurs de trésor n'ont rien à raconter qu'un nom et une rareté.
- **Deux descriptions distinctes.** `cards.description` = courte, affichée sur la
  carte dans le jeu. `cards.description_long` = texte de la page publique, saisi
  dans l'onglet admin Cartes. `cardLongDescription()` retombe sur la courte à
  l'affichage, **mais pas** pour décider de l'indexation (`{ fallback: false }`) —
  sans quoi une description de vignette suffirait à faire indexer une page vide.
- **La description longue est du HTML riche** (même éditeur que les notes de
  version : titres, listes, couleurs, tableaux, **liens**). Images désactivées
  (`allowImages={false}`) : elles seraient intégrées en base64 dans la colonne,
  donc servies à tous les joueurs avec le pool de cartes. Les fiches rédigées
  avant l'éditeur sont restées en **texte brut** et cohabitent dans la même
  colonne : tout affichage passe par `richTextHtml()` (`utils/richText.js`), qui
  convertit ce texte en paragraphes, puis par `sanitizeHtml()`.
- **Une fiche sans description longue part en `noindex`** et reste hors du sitemap
  (`MIN_INDEXABLE_DESCRIPTION`) : publier des pages réduites à un nom et une
  rareté nuirait au domaine. La rédiger l'indexe au build suivant. Le seuil
  compte le **texte** (`richTextLength`), jamais le balisage — sinon quelques
  `<p>` et une URL de lien suffiraient à le franchir.

## Documentation

L'infrastructure est documentée **dans `geocards-api`** (source unique) :

| Sujet | Fichier |
|---|---|
| Topologie, variables à synchroniser | `../geocards-api/docs/INFRA.md` |
| CI/CD, déploiement, rollback | `../geocards-api/docs/DEPLOY.md` |
| Bascule geocoins.fr → geocoins.io | `../geocards-api/docs/DOMAIN-MIGRATION.md` |

## Déploiement — Vercel

Push sur `main` → build Vercel. Variables dans Vercel → Settings → Environment
Variables ; référence dans [`.env.local.example`](.env.local.example).

⚠️ **Vite inline les `VITE_*` au BUILD.** Deux conséquences :

1. Modifier une variable dans Vercel n'a **aucun effet** sans redeploy.
2. Ces valeurs sont **publiques** dans le bundle — jamais de secret, jamais de
   `service_role` key.

`vite.config.js` émet `/version.json` (SHA du build) ; la SPA le sonde pour
proposer un rafraîchissement après déploiement. `vercel.json` lui impose
`Cache-Control: no-store` — **si ce fichier était mis en cache, les joueurs ne
verraient jamais les mises à jour.**

Rollback : Vercel → Deployments → *Promote to Production* sur le précédent.

## Pièges — lire avant de coder

Chacun a déjà causé un bug en production.

### Cohérence avec l'API

- **Une valeur de config visible par les joueurs doit exister à trois endroits** :
  `PUBLIC_KEYS` côté API, **et les deux `setLimits` de `useGameState`**. Une clé
  absente retombe sur un défaut en dur — d'où des écarts entre le prix affiché et
  le montant réellement débité (déjà arrivé plusieurs fois).
- **Toute statistique joueur calculée depuis `gs.cardPool` doit filtrer les
  cartes cachées** (`publicCardPool` dans `App.jsx`). Le pool admin contient des
  brouillons jamais publiés.
- **Ne jamais présumer du succès d'un appel API dans un toast.** Un toast de
  réussite affiché avant la réponse masque tous les refus serveur.

### iOS / Safari

- **`position: fixed` se cale sur le *layout viewport*, pas le viewport visuel.**
  Avec le clavier ouvert, un overlay fixe recouvre le champ de saisie ou place
  l'en-tête d'une modale hors d'atteinte. Utiliser `useVisualViewport.js` pour
  **tout** overlay.
- **Retour d'arrière-plan** : le champ de réponse revient focalisé sans clavier.
  Un `blur` au resume est en place (`useBlurOnResume.js`) — ce focus fantôme
  masquait un bandeau posé sur la ligne de saisie.
- **Taps traversants** : un tap raté sur le header au-dessus du bouton Participer
  déclenchait des changements de langue/thème. La protection anti tap-through est
  en place, ne pas la retirer.

### WebView Android (MIUI)

- `::-webkit-scrollbar` est ignoré. Toujours accompagner les règles webkit des
  propriétés standard `scrollbar-width` / `scrollbar-color`.
- **Double-tap = zoom.** Un bloc inerte qui apparaît sous le doigt à la place
  d'un bouton (l'annonce « en feu » remplace « Participer » 10 s) transforme les
  taps du joueur en double-tap-to-zoom : la page reste zoomée. `touch-action:
  manipulation` est posé sur `html` (`index.css`) — ne pas le retirer, et ne
  jamais le remplacer par `none` (casse le pinch-zoom et les gestes des modales).

### Domaines

- **`VITE_APP_URL` doit rester vide.** Le code retombe sur
  `window.location.origin` : chaque joueur revient sur le domaine par lequel il
  est arrivé. La définir figerait la redirection OAuth sur un seul domaine et
  casserait l'autre. Voir `useAuth.js`.
- Le site est servi sur `geocoins.io` **et** `geocoins.fr` — ne pas coder en dur
  un domaine dans une URL de redirection.
