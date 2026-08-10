# Kininaru Planner

Un planner de productivité premium — organisation, habitudes, objectifs, focus, journal, famille et un coach IA — pensé pour une utilisation quotidienne.

## Fonctionnalités

- **Tâches** : création, édition, priorités, échéances, étiquettes, sous-tâches
- **Habitudes** : suivi quotidien, séries (streaks), XP
- **Calendrier** : événements, vue mois/semaine
- **Journal** : entrées par jour, humeur
- **Focus** : sessions Pomodoro avec statistiques
- **Famille** : espace partagé (membres, rôles, tâches et événements communs, code d'invitation)
- **Coach IA** (Groq) : planification de journée, priorités, revue hebdomadaire, découpage d'objectifs — avec **actions proposées et confirmées par l'utilisateur** (création de tâches, habitudes, événements, mémoires)
- **Analyses & Récompenses** : graphiques 30 jours, badges
- **PWA** : installable, service worker, icônes complètes
- **i18n** : français / anglais
- **Thèmes** : 6 palettes de couleurs (clair et sombre)

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + RLS) · Groq (LLM via @ai-sdk/groq) · Framer Motion · date-fns

## Démarrage rapide

```bash
npm install
# créez ensuite un fichier .env.local (voir ci-dessous)
npm run dev
```

Ouvrez http://localhost:3000.

### Variables d'environnement (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase (publique) |
| `GROQ_API_KEY` | Clé API Groq (**côté serveur uniquement**, jamais exposée) |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site (ex. `http://localhost:3000` en dev, le domaine en prod — utilisée par le sitemap/SEO) |

> Les fichiers `.env*` sont ignorés par Git. Ne commitez jamais de clé.

### Base de données

Exécutez `supabase/schema.sql` dans le SQL Editor de votre projet Supabase (Dashboard → SQL Editor). Le script crée toutes les tables, les fonctions et les politiques de sécurité **RLS** (isolation stricte par utilisateur).

Puis exécutez `supabase/coach.sql` (fichier **additif**, sans risque) pour activer l'historique des conversations de l'AI Coach (`coach_conversations` + `coach_messages`, RLS par utilisateur). Sans lui, le chat fonctionne mais les conversations ne sont pas sauvegardées.

### Google OAuth (configuration externe)

Le code est prêt. Pour activer « Continuer avec Google » :

1. Supabase → **Authentication → Providers → Google** : renseignez Client ID et Client Secret (projet Google Cloud).
2. Google Cloud Console → **Identifiants OAuth 2.0** : ajoutez `https://<votre-domaine>/auth/callback` aux URI de redirection autorisées.

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (la validation TypeScript **bloque** en cas d'erreur) |
| `npm start` | Serveur de production (après `build`) |
| `npm run lint` | ESLint |
| `npm run test:ai` | Tests de validation des actions IA (hors-ligne) |
| `npm run test:ai:live` | Test de bout en bout authentifié IA → action → Supabase (nécessite `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `KIN_TEST_EMAIL`, `KIN_TEST_PASSWORD`) |

## Sécurité

- RLS active sur toutes les tables ; chaque requête est scopée à `auth.uid()`.
- La clé Groq reste **uniquement côté serveur** ; l'API `/api/chat` est authentifiée et limitée (20 requêtes/min).
- Les actions IA passent par une **whitelist validée côté serveur** — le modèle ne génère jamais de SQL et ne peut pas exécuter de code.
- Les pages privées sont protégées par le middleware + les layouts (`/auth/login?returnTo=…`).

## Notes de livraison

- La branche finale est `final-kininaru-v5` : projet à la **racine du dépôt** (après restructuration).
- Pages légales : `/legal/conditions`, `/legal/confidentialite`, `/legal/suppression-compte`.
- SEO : `sitemap.xml` (routes publiques uniquement) et `robots.txt` (pages privées et API désindexées).
