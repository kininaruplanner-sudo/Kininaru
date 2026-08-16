# Kininaru Planner

Un planner de productivité premium — organisation, habitudes, objectifs, focus, journal, famille et un coach IA — pensé pour une utilisation quotidienne.

## Fonctionnalités

- **Tâches** : création, édition, priorités, échéances, **heure planifiée** (le coach rappelle « ça commence dans 10 min »), étiquettes, sous-tâches, vue liste/kanban, lancement d'une session **Focus** directement depuis une tâche (▶ Commencer)
- **Objectifs** : direction durable des actions — objectifs actifs/atteints, **progression calculée sur les vraies tâches rattachées** (`tasks.goal_id`), création via le coach (journal → objectif → étapes, toujours avec confirmation) et rattachement des tâches depuis la page Tâches ; suivi sur le tableau de bord
- **Habitudes** : suivi quotidien, séries (streaks), XP
- **Calendrier** : événements, vue mois/semaine
- **Journal** : entrées par jour, humeur, **éditeur riche** (titres, sous-titres, gras, italique, souligné, listes, checklists interactives, citations, séparateurs, liens, émojis, images), **auto-save débouncé** (Sauvegarde… / ✓ Sauvegardé / ⚠ Réessayer), **aperçu** et **6 actions IA** (résumer, idées principales, réfléchir, créer un objectif, créer des tâches, créer un plan) — le flux *Journal → Pensée → Objectif → Tâches → Focus* se fait **avec confirmation** de chaque étape
- **Focus** : sessions Pomodoro (25/5/15), sons d'ambiance synthétisés (pluie, café), mode zen plein écran, statistiques hebdo, à la fin d'une session la tâche liée peut être marquée terminée (ou continuée)
- **Famille** : espace partagé (membres, rôles, tâches et événements communs, code d'invitation)
- **Coach IA** (Groq) : **coach flottant** avec observations contextuelles déterministes, fréquence contrôlable, planification de journée, priorités, **revue hebdomadaire**, découpage d'objectifs, **Smart Next Action** sur le tableau de bord, **boucle proactive PLAN → REMIND → START → REFLECT → LEARN/ADAPT** — avec **actions proposées et confirmées par l'utilisateur** (création de tâches, habitudes, événements, objectifs, mémoires) et **historique des conversations**
- **Réflexion après tâche** : quand une tâche est terminée, une micro-réflexion optionnelle (facile / neutre / difficile) rejoint le journal du jour — jamais obligatoire, jamais bloquante
- **Insights de progression** (LEARN/ADAPT) : tendances calculées sur les données réelles des 7 derniers jours (moment de concentration, complétion, habitudes) et carte « Demain pourrait être… » — **suggestions uniquement**, jamais de modification automatique du planning
- **Mémoire IA** : souvenirs visibles, contrôlables et supprimables depuis les Réglages (interrupteur maître, opt-in)
- **Notifications Web Push** : briefs du matin / soir / hebdomadaire, aides du coach, heures silencieuses, limite quotidienne, envoi de test
- **Analyses** : graphiques 30 jours et heatmap d'activité, accessibles à la demande via le Coach IA
- **Version bêta** : badge « BÊTA » discret près du logo, message bêta fermable (mémorisé), version affichée dans Paramètres → À propos
- **Retours utilisateurs** : depuis Paramètres → Aider à améliorer Kininaru, l'utilisateur connecté peut **signaler un bug** (type, description, étapes pour reproduire, gravité) ou **envoyer une suggestion** (réservé aux utilisateurs connectés, pas de retour anonyme en bêta) — enregistrés dans la table `feedback` (RLS), avec informations techniques automatiques (page, navigateur, appareil, version) mais jamais de contenu privé
- **PWA** : installable, service worker, icônes complètes (lotus), expérience standalone
- **Hors ligne** : création/édition/suppression de tâches mises en file localement (IndexedDB) puis synchronisées à la reconnexion, avec indicateur d'état (hors ligne · synchronisation · synchronisé) ; conflits jamais écrasés silencieusement (`lib/offline/sync-queue.ts`)
- **Alarmes** : créneaux quotidiens (heure locale, jours, son, vibration, snooze) distincts des rappels — planifiés localement, limites PWA documentées dans l'UI
- **Calendriers externes** : flux OAuth réels (Google Calendar, Microsoft Graph) avec callback, refresh de token et synchronisation serveur, abonnement **ICS** réel (URL validée, flux parsé, déduplication `(connection_id, external_event_id)`), section « Calendriers connectés » dans les Paramètres, guide public [`/docs/calendar-integrations.md`](/docs/calendar-integrations.md)
- **i18n** : français / anglais
- **Charte unique** : un seul thème clair, fond blanc épuré (#FFFFFF), avec la palette Memphis du logo (cyan #00C2E0 · marine #1A365D · orange vif #FF6B35 · terracotta #6A2B05) déclinée en système de design complet (fond, cartes, bordures, accents, graphiques, sidebar, dégradés) et en motifs géométriques discrets en arrière-plan

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
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | **Optionnel** — code Google Search Console **supplémentaire**. Le code principal est déjà intégré dans `app/layout.tsx` (propriété `verification.google` de la metadata Next.js). À définir uniquement si Google fournit un autre code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` Supabase (**serveur uniquement**) — requise pour l'envoi planifié des briefs push (cron). Ne jamais exposer |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Clé publique VAPID (publique) — requise pour les notifications Web Push |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Clé privée VAPID (**serveur uniquement**) |
| `WEB_PUSH_SUBJECT` | Contact du push (ex. `mailto:admin@kininaru.app`) |
| `CRON_SECRET` | Secret partagé qui protège `/api/cron/briefs` (en-tête `x-cron-secret`) |
| `KIN_TEST_EMAIL` / `KIN_TEST_PASSWORD` | Compte de test pour `npm run test:ai:live` |
| `ADMIN_FEEDBACK_WEBHOOK_URL` | **Optionnel** — URL d'un webhook (Discord, Slack, n8n…) prévenu à chaque nouveau retour utilisateur (`POST` fire-and-forget), **en plus** de l'email. |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | **Calendriers Google** — ID client OAuth (public par nature). Requis pour le bouton « Connecter » Google. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | **Calendriers Google** — secret OAuth (**serveur uniquement**). |
| `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` | **Calendriers Microsoft** — ID client Entra (public par nature). Requis pour le bouton « Connecter » Microsoft. |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | **Calendriers Microsoft** — secret Entra (**serveur uniquement**). |
| `SENDGRID_API_KEY` | **Requis pour l'email admin** — clé API SendGrid (**serveur uniquement**, plan gratuit 100 emails/jour). Sans elle, les retours restent dans Supabase mais aucun email n'est envoyé. |
| `ADMIN_FEEDBACK_EMAIL` | **Requis pour l'email admin** — destinataire des alertes (ex. `kininaru.planner@gmail.com`). Définie dans Vercel, jamais codée en dur dans le code. |
| `ADMIN_FEEDBACK_FROM_EMAIL` | **Optionnel** — expéditeur de l'alerte (adresse **vérifiée dans SendGrid** comme Single Sender). Si absente, l'expéditeur = destinataire (`ADMIN_FEEDBACK_EMAIL`). |

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
3. `supabase/feedback.sql` — active les **retours utilisateurs** (table `feedback`, RLS strict : chaque utilisateur ne crée/consulte que ses propres retours, aucune modification/suppression possible, pas de page admin publique). **Décision bêta : les retours sont réservés aux utilisateurs connectés** — l'API `/api/feedback` exige une session et pose `user_id` depuis celle-ci ; aucun retour anonyme n'est accepté. Sans lui, le formulaire affiche une erreur à l'envoi.
4. `supabase/alarms.sql` — active les **alarmes** (table `alarms`, RLS par utilisateur). Sans lui, la page Alarmes s'affiche mais rien ne peut être enregistré.
5. `supabase/calendar.sql` — active les **calendriers externes** (`calendar_connections` + `calendar_synced_events`, RLS par utilisateur). Sans lui, la section « Calendriers connectés » des Paramètres reste vide.
6. `supabase/calendar-security.sql` — **sécurité des tokens OAuth** : révoque tout accès client aux tables de connexion et expose une fonction `my_calendar_connections()` qui ne renvoie QUE les champs sûrs (jamais `access_token`/`refresh_token`). Toutes les mutations passent par les routes API. Sans lui, les tokens restent théoriquement lisibles par le navigateur.
7. `supabase/offline.sql` — active le **registre de synchronisation hors ligne** (table `sync_queue`, RLS par utilisateur). La file locale (IndexedDB) fonctionne sans lui ; il conserve la trace des opérations rejouées et des conflits.
8. `supabase/goals.sql` — active les **Objectifs** (table `goals` + colonne `tasks.goal_id`, RLS par utilisateur). Sans lui, la page Objectifs s'affiche mais rien ne peut être enregistré et l'action IA `create_goal` échoue.
9. `supabase/reminders.sql` — active les **rappels temporels** (colonne `tasks.scheduled_time` + déduplication `push_send_log.reminder_key`). Sans lui, l'heure planifiée n'est pas persistée et le cron de rappels ne peut pas dédupliquer.
10. `supabase/scheduler.sql` — planifie les crons dans Supabase (pg_cron + pg_net : brief du soir 20:00 UTC, brief hebdo lundi 08:00 UTC, rappels toutes les 15 min) et autorise le type de notification `reminder`. Aucun secret ni domaine codé en dur : les valeurs sont lues dans la table serveur `public.app_config` (`app_url`, `cron_secret`) — **à renseigner une fois dans le SQL Editor** (voir l'en-tête du fichier). Sans lui : brief du matin et maintenance via le cron Vercel unique, briefs soir/hebdo et rappels uniquement quand l'app est ouverte.
11. `supabase/timezone.sql` — ajoute `profiles.timezone` (nom IANA) : le cron de rappels convertit alors `scheduled_time` (heure mur locale) en instant UTC exact pour chaque utilisateur. Sans lui, les rappels serveur retombent sur UTC.
12. `supabase/oauth-states.sql` — **sécurité OAuth** : table des états one-time (anti-CSRF / anti-replay) utilisée par les flux Google/Microsoft. Sans lui, le bouton « Connecter » des calendriers affiche une erreur explicite (aucun faux succès).
13. `supabase/calendar-sync-rpc.sql` — **import atomique** des événements de calendrier (transaction PostgreSQL unique : événement + mapping ensemble, suppression fenêtrée des événements disparus). Sans lui, la synchronisation affiche une erreur explicite.
14. `supabase/ai-rate-limit.sql` — **rate limit IA distribué** (chat / actions / journal) : compteurs atomiques par utilisateur, globaux entre instances serverless. Sans lui, le fallback mémoire local reste actif (limite par instance).
15. `supabase/calendar-vault.sql` — **OPTIONNEL** (plans Supabase avec `supabase_vault`) : préparation au chiffrement des tokens OAuth au repos. Ne pas exécuter avant la bascule runtime documentée dans le fichier.

### Consulter les retours utilisateurs (admin)

La table `feedback` est la source principale. Chaque retour est immuable (RLS sans update/delete) et n'est lisible que par son auteur. Pour les consulter :

- **Supabase Dashboard → Table Editor → `feedback`**, ou
- SQL Editor (rôle service) : `select * from public.feedback order by created_at desc;`

**Notification email** : définissez `SENDGRID_API_KEY` et `ADMIN_FEEDBACK_EMAIL` (destinataire, ex. `kininaru.planner@gmail.com`), et un email est envoyé à chaque nouveau retour (contenu, catégorie, gravité, page, navigateur, appareil, version, date — aucune donnée privée, la clé SendGrid reste côté serveur). Expéditeur : vérifiez une adresse dans SendGrid (Single Sender) ; par défaut, l'expéditeur = le destinataire. **Webhook optionnel** : définissez `ADMIN_FEEDBACK_WEBHOOK_URL` (Discord, Slack, n8n…) pour recevoir aussi un `POST` JSON. Une erreur d'envoi ne bloque jamais l'enregistrement du retour.

### Architecture des crons (compatible Vercel Hobby)

**Contrainte** : le plan Vercel Hobby n'autorise qu'**une exécution de cron par jour** (±59 min). `vercel.json` ne déclare donc qu'**un seul cron** : `0 7 * * *` → `POST /api/cron/daily`, qui fait matin + maintenance.

Tout le reste est planifié **dans Supabase** (plan gratuit, déjà utilisé par le projet) via **pg_cron + pg_net** : les jobs PostgreSQL appellent les endpoints Vercel avec l'en-tête `x-cron-secret` — aucune limite Hobby, aucun coût supplémentaire.

| Tâche | Fréquence | Source | Endpoint |
|---|---|---|---|
| **Daily Brief** (matin) | 1×/jour, 07:00 UTC | Vercel Cron (Hobby OK) | `/api/cron/daily` |
| **Maintenance** (logs push, file sync, notifications lues > 30 j) | 1×/jour | Vercel Cron (même appel) | `/api/cron/daily` |
| **Evening Brief** | 1×/jour, 20:00 UTC | Supabase pg_cron | `/api/cron/briefs` |
| **Weekly Brief** | 1×/semaine, lundi 08:00 UTC | Supabase pg_cron | `/api/cron/briefs` |
| **Rappels temporels** (tâches/événements imminents) | toutes les 15 min | Supabase pg_cron | `/api/cron/reminders` |

**Mise en place (Supabase)** : exécutez `supabase/calendar-security.sql` (table serveur `public.app_config`), puis `supabase/scheduler.sql`, puis renseignez une fois dans le SQL Editor :
```sql
update public.app_config set value = 'https://kininaru-planner.vercel.app' where key = 'app_url';
update public.app_config set value = 'VOTRE_VRAI_SECRET' where key = 'cron_secret';
```
Aucun secret réel n'est commité (placeholders uniquement) et les jobs se relancent sans doublon (`cron.unschedule` avant `cron.schedule`). Le fichier corrige aussi la contrainte `notifications.type` pour autoriser les rappels (`'reminder'`).

**Coût** : ~3 000 invocations Vercel/mois (96/jour pour les rappels + ~3/jour briefs + 1/jour daily) — très en dessous des limites du plan gratuit. Pas de changement nécessaire ailleurs (SendGrid : emails de feedback uniquement, limites intactes).

**Redondance / dégradation douce** : si pg_cron n'est pas configuré, le produit continue de fonctionner — brief du matin via le cron Vercel unique, briefs soir/hebdo et rappels via le scheduler client quand l'app est ouverte (`lib/coach/scheduler.ts`). La déduplication par type/jour (`push_send_log`) empêche tout double envoi si deux sources se chevauchent.

**Fuseaux horaires** : les schedulers tournent **en UTC** (07:00, 20:00, lundi 08:00 UTC) ; le type de brief est déduit de l'heure UTC courante. Une préférence de timezone par utilisateur est une amélioration future.

**Sécurité** : tous les endpoints cron (`/api/cron/daily`, `/api/cron/briefs`, `/api/cron/reminders`) exigent `x-cron-secret: <CRON_SECRET>` (ou `Authorization: Bearer`) et refusent toute autre requête (401) ; sans `CRON_SECRET` configuré, ils répondent 503 et ne font rien.

### Google OAuth (configuration externe)

Le code est prêt. Pour activer « Continuer avec Google » :

1. Supabase → **Authentication → Providers → Google** : renseignez Client ID et Client Secret (projet Google Cloud).
2. Google Cloud Console → **Identifiants OAuth 2.0** : ajoutez `https://<votre-domaine>/auth/callback` aux URI de redirection autorisées.

## Scripts

- `npm run icons` — régénère toutes les icônes (PNG/ICO) depuis `public/icon.svg` (source unique, lotus).


| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (la validation TypeScript **bloque** en cas d'erreur) |
| `npm start` | Serveur de production (après `build`) |
| `npm run lint` | ESLint |
| `npm run test:ai` | Tests de validation des actions IA (hors-ligne) |
| `npm run test:ai:live` | Test de bout en bout authentifié IA → action → Supabase (nécessite `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `KIN_TEST_EMAIL`, `KIN_TEST_PASSWORD`) |

## Architecture

```
app/
  (app)/              Pages authentifiées (layout + navigation commune)
    dashboard/        « Que faire maintenant ? » — prochaine action, focus, habitudes, progression
    tasks/            Tâches (liste, priorités, sous-tâches, kanban)
    habits/           Habitudes (séries, XP)
    calendar/         Événements
    journal/          Journal avec éditeur riche + auto-save
    focus/            Sessions Focus / Pomodoro
    ai/               Assistant IA (conversation, mémoire, actions)
    analytics/        Statistiques (30 j) — accessible à la demande via le Coach
    family/           Espace famille partagé
    settings/         Préférences, notifications, PWA, voix, compte
  api/                Routes serveur (chat IA, actions IA, coach, push, cron, feedback)
  auth/               Connexion / inscription / réinitialisation
  legal/              Pages légales
components/           UI réutilisable (shell, sidebar, mobile-nav, coach, install PWA…)
lib/
  ai/                 Prompts + whitelist des actions IA (validation serveur)
  coach/              Règles du coach (déterministes, hors IA), préférences, fréquences, briefs
  supabase/           Clients serveur / navigateur / service (RLS respectées)
  web-push/           Abonnement, envoi VAPID, format des notifications
  journal/            Conversion markdown de l'éditeur
  i18n.tsx            Traductions fr / en
public/               PWA : icônes, manifest, service worker (sw.js), assetlinks
scripts/              Tests hors-ligne de validation IA
supabase/             Schéma SQL, RLS, migrations additives (coach, push, feedback)
```

Séparation des responsabilités : les composants gèrent l'UI, les hooks et `lib/`
portent la logique métier, les routes `app/api/*` encapsulent les appels serveur
(Groq, cron, push), et tout accès Supabase passe par les clients typés de
`lib/supabase` (RLS actives — jamais de `service_role` côté client).

## Sécurité

- RLS active sur toutes les tables ; chaque requête est scopée à `auth.uid()`.
- La clé Groq reste **uniquement côté serveur** ; l'API `/api/chat` est authentifiée et limitée (20 requêtes/min), `/api/ai/actions` 40/min, `/api/ai/journal` 10/min — compteurs **distribués** (Supabase, `supabase/ai-rate-limit.sql`), plus une limite purement locale.
- Les actions IA passent par une **whitelist validée côté serveur** — le modèle ne génère jamais de SQL et ne peut pas exécuter de code.
- La clé `service_role` est réservée au cron serveur ; jamais utilisée depuis le client.
- Les données IA sont **minimales** : le journal n'envoie que l'entrée sélectionnée, la mémoire n'est injectée que si l'utilisateur l'active.
- Les pages privées sont protégées par le middleware + les layouts (`/auth/login?returnTo=…`).

## Informations complémentaires

- Pages légales : `/legal/conditions`, `/legal/confidentialite`, `/legal/suppression-compte`.
- SEO : `sitemap.xml` (routes publiques uniquement) et `robots.txt` (pages privées et API désindexées).
- PWA Android (TWA) : le manifest et l'icône maskable sont dans `public/` ; `public/.well-known/assetlinks.json` contient la liaison de domaine attendue.
- Variables d'environnement : la liste complète des noms figure dans le tableau ci-dessus — copiez-les dans un fichier `.env.local` (ou dans le panneau API Keys / Vercel) et renseignez chaque valeur. Ne commitez jamais de vraies clés.
