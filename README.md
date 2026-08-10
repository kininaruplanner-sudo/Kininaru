# Kininaru Planner

Un planner de productivité premium — organisation, habitudes, objectifs, focus, journal, famille et un coach IA — pensé pour une utilisation quotidienne.

## Fonctionnalités

- **Tâches** : création, édition, priorités, échéances, étiquettes, sous-tâches, vue liste/kanban, lancement d'une session **Focus** directement depuis une tâche (▶ Commencer)
- **Habitudes** : suivi quotidien, séries (streaks), XP
- **Calendrier** : événements, vue mois/semaine
- **Journal** : entrées par jour, humeur, **éditeur riche** (titres, sous-titres, gras, italique, souligné, listes, checklists interactives, citations, séparateurs, liens, émojis, images), **auto-save débouncé** (Sauvegarde… / ✓ Sauvegardé / ⚠ Réessayer), **aperçu** et **6 actions IA** (résumer, idées principales, réfléchir, créer un objectif, créer des tâches, créer un plan) — le flux *Journal → Pensée → Objectif → Tâches → Focus* se fait **avec confirmation** de chaque étape
- **Focus** : sessions Pomodoro (25/5/15), sons d'ambiance synthétisés (pluie, café), mode zen plein écran, statistiques hebdo, à la fin d'une session la tâche liée peut être marquée terminée (ou continuée)
- **Famille** : espace partagé (membres, rôles, tâches et événements communs, code d'invitation)
- **Coach IA** (Groq) : **coach flottant** avec observations contextuelles déterministes, fréquence contrôlable, planification de journée, priorités, **revue hebdomadaire**, découpage d'objectifs, **Smart Next Action** sur le tableau de bord — avec **actions proposées et confirmées par l'utilisateur** (création de tâches, habitudes, événements, mémoires) et **historique des conversations**
- **Mémoire IA** : souvenirs visibles, contrôlables et supprimables depuis les Réglages (interrupteur maître, opt-in)
- **Notifications Web Push** : briefs du matin / soir / hebdomadaire, aides du coach, heures silencieuses, limite quotidienne, envoi de test
- **Analyses & Récompenses** : graphiques 30 jours, badges
- **PWA** : installable, service worker, icônes complètes
- **i18n** : français / anglais
- **Thèmes** : 6 palettes de couleurs (clair et sombre)

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + RLS) · Groq (LLM via @ai-sdk/groq) · Web Push (VAPID) · Framer Motion · date-fns

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
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` Supabase (**serveur uniquement**) — requise pour l'envoi planifié des briefs push (cron). Ne jamais exposer |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Clé publique VAPID (publique) — requise pour les notifications Web Push |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Clé privée VAPID (**serveur uniquement**) |
| `WEB_PUSH_SUBJECT` | Contact du push (ex. `mailto:admin@kininaru.app`) |
| `CRON_SECRET` | Secret partagé qui protège `/api/cron/briefs` (en-tête `x-cron-secret`) |
| `KIN_TEST_EMAIL` / `KIN_TEST_PASSWORD` | Compte de test pour `npm run test:ai:live` |

> Les fichiers `.env*` sont ignorés par Git. Ne commitez jamais de clé.

Générez une paire de clés VAPID avec :
```bash
npx web-push generate-vapid-keys --json
```

### Base de données

Exécutez `supabase/schema.sql` dans le SQL Editor de votre projet Supabase (Dashboard → SQL Editor). Le script crée toutes les tables, les fonctions et les politiques de sécurité **RLS** (isolation stricte par utilisateur).

Puis exécutez les fichiers **additifs** (sans risque, relançables) :

1. `supabase/coach.sql` — active l'historique des conversations de l'AI Coach (`coach_conversations` + `coach_messages`, RLS par utilisateur). Sans lui, le chat fonctionne mais les conversations ne sont pas sauvegardées.
2. `supabase/push.sql` — active les notifications Web Push (`push_subscriptions` + `push_send_log`, RLS par utilisateur). Sans lui, tout fonctionne sauf le push réel.

### Briefs planifiés (matin / soir / hebdomadaire)

L'endpoint `POST /api/cron/briefs` envoie les briefs aux utilisateurs qui ont opté-in (respect des heures silencieuses, dédoublonnage par jour et plafond quotidien). Il ne se déclenche jamais tout seul :

- **Vercel** : `vercel.json` déclare déjà les crons (7h, 20h, lundi 8h). Ajoutez les variables d'environnement sur le projet Vercel (dont `CRON_SECRET` et `SUPABASE_SERVICE_ROLE_KEY`).
- **Ailleurs** : planifiez un cron externe qui appelle `POST /api/cron/briefs` avec l'en-tête `x-cron-secret: <CRON_SECRET>`.

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
- La clé `service_role` est réservée au cron serveur ; jamais utilisée depuis le client.
- Les données IA sont **minimales** : le journal n'envoie que l'entrée sélectionnée, la mémoire n'est injectée que si l'utilisateur l'active.
- Les pages privées sont protégées par le middleware + les layouts (`/auth/login?returnTo=…`).

## Notes de livraison

- La branche finale est `final-kininaru-v5` : projet à la **racine du dépôt** (après restructuration).
- Pages légales : `/legal/conditions`, `/legal/confidentialite`, `/legal/suppression-compte`.
- SEO : `sitemap.xml` (routes publiques uniquement) et `robots.txt` (pages privées et API désindexées).
