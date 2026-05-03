# 🗺️ GeoCards

Jeu de cartes à collectionner basé sur le géocaching.  
Réponds aux questions, gagne des cartes, vends tes doublons sur le marché.

---

## 🚀 Démarrage rapide

### Prérequis
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **VS Code** — [code.visualstudio.com](https://code.visualstudio.com)

### Installation

```bash
# 1. Cloner ou dézipper le projet, puis entrer dans le dossier
cd geocards

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

L'app s'ouvre automatiquement sur **http://localhost:5173**

### Autres commandes

```bash
npm run build    # Build de production (dossier dist/)
npm run preview  # Prévisualiser le build de production
npm run lint     # Vérifier le code (ESLint)
npm run format   # Formater le code (Prettier)
```

---

## 📁 Structure du projet

```
geocards/
├── public/
│   └── favicon.svg
├── src/
│   ├── i18n/
│   │   └── translations.js     # 🌍 4 langues : FR / EN / DE / ES
│   ├── data/
│   │   ├── cards.js            # Pool de cartes + achievements
│   │   ├── questions.js        # Questions géocaching
│   │   ├── npcs.js             # Joueurs NPC simulés
│   │   └── constants.js        # QUIZ_INTERVAL, limites, etc.
│   ├── hooks/
│   │   └── useGameState.js     # 🎮 State centralisé du jeu
│   ├── utils/
│   │   ├── gameUtils.js        # Helpers purs (rndCard, genMarket…)
│   │   └── styles.js           # Constantes de style partagées
│   ├── components/
│   │   ├── Card.jsx            # Composant carte réutilisable
│   │   └── MaintenanceScreen.jsx
│   ├── features/
│   │   ├── auth/               # AuthModal, SettingsModal
│   │   ├── quiz/               # QuizNotif, QuizModal, CountdownWidget
│   │   ├── market/             # MarketModal (carnet d'ordres)
│   │   ├── shop/               # ShopModal (dons 2,99€)
│   │   ├── leaderboard/        # LeaderboardModal
│   │   ├── achievements/       # AchievementToast, SaleNotif, TxHistory
│   │   └── admin/              # AdminPanel complet
│   ├── App.jsx                 # Composant racine
│   ├── main.jsx                # Entry point React
│   └── index.css               # Animations globales
├── .vscode/
│   ├── extensions.json         # Extensions VS Code recommandées
│   └── settings.json           # Config éditeur (format on save, etc.)
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## 🌍 Langues

L'interface est disponible en **Français 🇫🇷**, **English 🇬🇧**, **Deutsch 🇩🇪** et **Español 🇪🇸**.

Le sélecteur de langue est dans le header. Le choix est persisté en `localStorage`.

---

## 🎮 Fonctionnalités

| Feature | Détail |
|---|---|
| **Quiz** | Question toutes les 60s, premier à répondre gagne la carte |
| **Collection** | 18 cartes + 11 cartes Achievement, 4 raretés |
| **Marché** | Carnet d'ordres agrégé par paliers, vente de doublons |
| **Achievements** | 11 achievements avec cartes-récompenses |
| **Shop** | Don 2,99€ → 10 cartes (Stripe / PayPal) |
| **Classement** | Paginé, visualisation des collections |
| **Admin** | Gestion cartes, types, questions, joueurs, IPs, maintenance |
| **i18n** | 4 langues, détection navigateur, persistance |

---

## 🔧 Extensions VS Code recommandées

Quand tu ouvres le projet, VS Code proposera d'installer automatiquement :

- **ESLint** — erreurs en temps réel
- **Prettier** — formatage automatique à la sauvegarde
- **Error Lens** — erreurs affichées sur la ligne concernée
- **GitLens** — historique Git dans l'éditeur
- **ES7+ React Snippets** — raccourcis (`rafce`, etc.)
- **Thunder Client** — client HTTP intégré pour tester l'API

---

## 🗺️ Roadmap backend

Ce prototype utilise du state React local.  
La prochaine étape est le backend (voir `geocards_cdc.docx`) :

- **PostgreSQL** (Supabase) — persistance
- **Node.js + Express** — API REST
- **Socket.io** — quiz et notifications temps réel
- **Supabase Auth** — Google OAuth + email
- **Redis** (Upstash) — cache marché, sessions
- **Fly.io** — hébergement API (~3€/mois)
- **Vercel** — hébergement frontend (gratuit)

---

## 💝 Coûts d'infrastructure (phase 1, ~40 utilisateurs simultanés)

| Poste | Coût |
|---|---|
| Fly.io API (shared-cpu-1x) | ~3 €/mois |
| Domaine (.fr) | ~0,50 €/mois |
| Supabase, Vercel, Redis, Sentry, Resend | **Gratuit** |
| **Total** | **~3,50 €/mois** |
