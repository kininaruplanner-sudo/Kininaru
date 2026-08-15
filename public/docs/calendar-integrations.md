# Calendriers externes — guide d'intégration (§28)

Kininaru centralise votre journée : tâches, habitudes, Focus **et** vos
calendriers existants (Google, Microsoft Outlook/365, Apple/iCloud via ICS).

## État actuel (ce dépôt)

| Pièce | Statut | Emplacement |
|---|---|---|
| Schéma SQL (connexions + déduplication) | ✅ prêt | `supabase/calendar.sql` |
| Abstraction multi-fournisseurs | ✅ prête | `lib/calendar/providers.ts` |
| UI « Calendriers connectés » (Paramètres) | ✅ prête | `components/calendar-connections.tsx` |
| Route OAuth de démarrage | 🟠 prête, devient fonctionnelle dès que les clés sont posées | `app/api/calendar/[provider]/connect` |
| Route de synchronisation | 🟠 à brancher (dépend des clés) | `app/api/calendar/[provider]/sync` |
| Callback OAuth + moteur d'import | 🔴 à implémenter après la config des clés | — |

## 1. Google Calendar

1. Console Google Cloud → créer un projet → **APIs & services → Identifiants → Créer un ID client OAuth**.
   - Type : **Application web**
   - URI de redirection autorisée : `https://VOTRE-DOMAINE/api/calendar/google/callback`
2. Activer l'API **Google Calendar API**.
3. Scope demandé : **`https://www.googleapis.com/auth/calendar.readonly`** (lecture seule —
   on ne demande jamais plus que nécessaire, §28.14). Pour la synchronisation
   bidirectionnelle, ajouter plus tard `calendar.events` et basculer `sync_mode` sur
   `read_write` — jamais par défaut.
4. Variables d'environnement (Vercel / production) :
   - `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (public par nature — un ID client OAuth n'est
     **pas** un secret)
   - `GOOGLE_OAUTH_CLIENT_SECRET` (secret — serveur uniquement)
5. Une fois posées, le bouton « Connecter » de Paramètres → Calendriers connectés
   lance le flux OAuth officiel.

## 2. Microsoft Outlook / Microsoft 365

1. Portail Azure → **Inscriptions d'applications** → Nouvelle inscription.
   - URI de redirection : `https://VOTRE-DOMAINE/api/calendar/microsoft/callback`
2. Permissions API (Microsoft Graph) : `Calendars.Read` (délégation).
3. Variables :
   - `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` (public)
   - `MICROSOFT_OAUTH_CLIENT_SECRET` (secret — serveur uniquement)

## 3. Apple / iCloud — abonnement ICS

Il n'existe **pas** d'API OAuth officielle pour iCloud Calendar accessible depuis
une PWA. La méthode officiellement compatible est l'**abonnement ICS** :
1. Sur iCloud.com → Calendrier → paramètres → **Partager un calendrier → URL publique**.
2. Ajoutez l'URL du flux `.ics` dans Kininaru (fournisseur « Apple / iCloud · ICS »).
3. Kininaru importe les événements en lecture seule (raffraîchissement périodique).
   Les calendriers partagés privés peuvent nécessiter l'ajout du flux dans un
   compte qui le sert via une URL authentifiée.

## 4. Déduplication (§28.6)

`calendar_synced_events` mappe `(connection_id, external_event_id)` → événement
Kininaru avec `unique (connection_id, external_event_id)`. Un événement externe
est donc importé **une seule fois**, même après plusieurs synchronisations ou une
reconnexion. La modification d'un événement externe met à jour l'événement lié ;
sa suppression côté fournisseur est propagée **sans jamais supprimer silencieusement
une donnée locale** : l'événement Kininaru est conservé et marqué « non synchronisé ».

## 5. Conflits (§28.8)

Résolution documentée (jamais d'écrasement silencieux) :
1. **Modifié ailleurs** → la version externe gagne pour les champs synchronisés,
   l'événement Kininaru est mis à jour et `last_synced_at` reflète la date.
2. **Modifié simultanément** → la modification locale la plus récente gagne sur
   les champs locaux ; les champs synchronisés reviennent à la version externe ;
   `sync_error` affiche l'avertissement.
3. **Supprimé ailleurs** → l'événement reste local (marqué « non synchronisé »),
   l'utilisateur décide.
4. **Calendrier inaccessible / token expiré** → `sync_error` est renseigné dans
   l'UI ; les événements déjà synchronisés restent consultables hors ligne.

## 6. Hors ligne (§28.9)

Les événements déjà synchronisés sont consultables hors ligne (données déjà
chargées). Les nouvelles modifications hors ligne passent par la file de
synchronisation générale (`lib/offline/sync-queue.ts`) et sont rejouées à la
reconnexion. L'état affiché est « Hors ligne · dernière synchronisation : … ».

## 7. Sécurité (§28.14)

- Aucun mot de passe n'est jamais stocké — OAuth uniquement.
- Les tokens d'accès/refresh vivent **côté serveur uniquement**. En production,
  chiffrez-les avec **Supabase Vault** (les colonnes `access_token` /
  `refresh_token` existent dans le schéma ; l'API ne les renvoie jamais au client).
- Déconnexion = suppression de la ligne `calendar_connections` + révocation du
  token via l'API du fournisseur (à brancher dans le moteur de sync).

## Variables d'environnement (récapitulatif)

| Variable | Public ? | Rôle |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | oui | ID client OAuth Google (public par nature) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | non | Secret Google — serveur uniquement |
| `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` | oui | ID client Azure AD |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | non | Secret Microsoft — serveur uniquement |
