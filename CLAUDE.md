# geocards (front) — Guide de travail

SPA React + Vite de **Geocoins**. Le backend est le repo voisin `geocards-api`,
qui porte aussi la documentation d'infrastructure.

## Commandes

```bash
npm run dev      # vite, http://localhost:5173
npm run lint     # eslint    ← doit passer avant tout push
npm run test     # vitest    ← doit passer avant tout push
npm run build    # vite build → dist/
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
  features/        — un dossier par domaine (quiz, market, shop, admin…)
  components/      — composants réutilisables
  i18n/translations.js — 4 langues : fr / en / de / es
  services/, utils/, data/, lib/
```

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

### Domaines

- **`VITE_APP_URL` doit rester vide.** Le code retombe sur
  `window.location.origin` : chaque joueur revient sur le domaine par lequel il
  est arrivé. La définir figerait la redirection OAuth sur un seul domaine et
  casserait l'autre. Voir `useAuth.js`.
- Le site est servi sur `geocoins.io` **et** `geocoins.fr` — ne pas coder en dur
  un domaine dans une URL de redirection.
