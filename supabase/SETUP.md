# 🗄️ Setup Supabase — GeoCards

Guide pas à pas pour configurer le backend Supabase.

---

## Étape 1 — Créer le projet Supabase

1. Va sur [app.supabase.com](https://app.supabase.com)
2. **New project** → nom : `geocards` → mot de passe DB → région `West EU (Ireland)`
3. Attends ~2 min que le projet démarre

---

## Étape 2 — Récupérer les clés API

Dans ton projet Supabase → **Settings** → **API** :

- Copie `Project URL` → `VITE_SUPABASE_URL`
- Copie `anon public` key → `VITE_SUPABASE_ANON_KEY`

Crée le fichier `.env.local` à la racine du projet :

```bash
cp .env.local.example .env.local
# Édite .env.local avec tes vraies valeurs
```

---

## Étape 3 — Créer le schéma de base de données

Dans Supabase → **SQL Editor** → **New query** :

1. Colle le contenu de `supabase/schema.sql`
2. Clique **Run**

✅ Toutes les tables, RLS policies et triggers sont créés.

---

## Étape 4 — Configurer Google OAuth

### Dans Google Cloud Console

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. Crée un projet (ou sélectionne le tien)
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
4. Application type : **Web application**
5. Authorized redirect URIs — ajoute :
   ```
   https://TON_PROJECT_ID.supabase.co/auth/v1/callback
   ```
6. Copie `Client ID` et `Client Secret`

### Dans Supabase

1. **Authentication** → **Providers** → **Google**
2. Active le provider
3. Colle `Client ID` et `Client Secret`
4. Save

---

## Étape 5 — Configurer les URLs de redirection

Dans Supabase → **Authentication** → **URL Configuration** :

- **Site URL** : `http://localhost:5173` (dev) → changer en prod
- **Redirect URLs** : ajoute `http://localhost:5173/**`

---

## Étape 6 — Installer le SDK et lancer

```bash
# Dans le dossier geocards/
npm install @supabase/supabase-js
npm run dev
```

L'app détecte automatiquement si Supabase est configuré.  
Sans `.env.local`, elle tourne en **mode local** (state React, pas de persistance).

---

## Étape 7 — Vérifier que ça marche

1. Lance `npm run dev`
2. Clique **Se connecter** → **Continuer avec Google**
3. Après login, ton pseudo doit apparaître dans le header
4. Dans Supabase → **Table Editor** → `profiles` → tu vois ton compte

---

## Structure des tables

| Table | Description |
|---|---|
| `profiles` | Joueurs (pseudo, or, streak, historique) |
| `cards` | Pool de cartes global |
| `collections` | Cartes possédées par joueur |
| `market_listings` | Annonces de vente actives |
| `transactions` | Historique achats/ventes |
| `questions` | Questions géocaching |
| `quiz_sessions` | Quiz en cours / résolus |
| `achievements` | Achievements débloqués |
| `banned_ips` | IPs bannies |
| `config` | Limites quotidiennes, maintenance |

---

## Troubleshooting

**"Email not confirmed"** → Va dans Authentication → Users → confirme manuellement l'email pour les tests.

**"Permission denied"** → Vérifie que RLS est bien activé et que les policies sont créées (SQL Editor → `select * from pg_policies`).

**Boucle infinie OAuth** → Vérifie que l'URL de redirect dans Google Console correspond exactement à celle de Supabase.
