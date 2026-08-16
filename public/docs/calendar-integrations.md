# Calendriers externes — guide d'intégration (§28)

Kininaru centralise votre journée : tâches, habitudes, Focus **et** vos
calendriers existants (Google, Microsoft Outlook/365, Apple/iCloud via ICS).

## État actuel (ce dépôt)

| Pièce | Statut | Emplacement |
|---|---|---|
| Schéma SQL (connexions + déduplication) | ✅ prêt | `supabase/calendar.sql` |
| Sécurité des tokens (accès client révoqué + RPC champs sûrs) | ✅ prêt — **à exécuter** | `supabase/calendar-security.sql` |
| Abstraction multi-fournisseurs | ✅ prête | `lib/calendar/providers.ts` |
| UI « Calendriers connectés » (Paramètres) | ✅ prête (formulaire ICS réel) | `components/calendar-connections.tsx` |
| Route OAuth de démarrage (state aléatoire one-time, anti-CSRF) | ✅ fonctionnelle dès que les clés sont posées | `app/api/calendar/[provider]/connect` |
| Callbacks OAuth (consommation du state + échange + refresh + rattachement) | ✅ implémentés | `app/api/calendar/{google,microsoft}/callback` |
| Route de synchronisation (Google / Graph / ICS, pagination + RPC atomique) | ✅ implémentée | `app/api/calendar/[provider]/sync` |
| Abonnement ICS (URL validée + flux parsé) | ✅ implémenté | `app/api/calendar/ics/subscribe` + `lib/calendar/ics.ts` |
| Déconnexion serveur | ✅ implémentée | `app/api/calendar/[provider]/disconnect` |
| Table des états OAuth (one-time, expirés) | ✅ prêt — **à exécuter** | `supabase/oauth-states.sql` |
| RPC d'import atomique (transaction + suppression fenêtrée) | ✅ prêt — **à exécuter** | `supabase/calendar-sync-rpc.sql` |

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
     (exactement — sans slash final, même protocole, même chemin ; en local :
     `http://localhost:3000/api/calendar/microsoft/callback`).
2. **Types de comptes pris en charge — LE POINT CRITIQUE :**
   - Kininaru accepte les **comptes Microsoft personnels (outlook.com, hotmail…)
     ET les comptes professionnels/scolaires (Microsoft 365 / Entra ID)** — c'est
     ce que le code demande via l'autorité
     `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` (le tenant
     `common` du endpoint v2).
   - L'inscription Entra doit donc être réglée sur **« Comptes dans un annuaire
     organisationnel et comptes Microsoft personnels » (multi-tenant +
     personnels)**. Si elle est réglée sur « Comptes de cet annuaire uniquement »
     (single-tenant), un utilisateur d'un autre tenant (ou un compte personnel)
     reçoit l'erreur :
     > *« Le compte d'utilisateur sélectionné n'existe pas dans le client
     > “Microsoft Services” et ne peut pas accéder à l'application
     > “<app-id>” dans ce client. Le compte doit d'abord être ajouté en tant
     > qu'utilisateur externe dans le client. »*
   - **Correction** : Azure Portal → Inscriptions d'applications → votre app →
     « Authentification » → « Types de comptes pris en charge » → cocher
     **« Comptes dans un annuaire organisationnel et comptes Microsoft
     personnels »** → Enregistrer. Aucun changement de code nécessaire (l'autorité
     `common` est déjà la bonne).
3. Permissions API (Microsoft Graph) : **`Calendars.Read`** (délégation) +
   **`offline_access`** (automatique avec le flux v2 — refresh token).
4. Identité du compte : le code identifie l'utilisateur via **GET /me** (l'objet
   `id` de Graph, stable), pas via le calendrier par défaut — l'affichage reprend
   `displayName`/`mail`. La lecture des événements utilise ensuite
   `/me/calendarview` (calendrier par défaut, occurrences expansées).
5. Variables :
   - `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` (public)
   - `MICROSOFT_OAUTH_CLIENT_SECRET` (secret — serveur uniquement)

## 2bis. Sécurité OAuth : le state (anti-CSRF / anti-replay)

Depuis la correction de sécurité, le flux ne met **plus jamais l'user id en
clair dans l'URL**. À la place :
1. `connect` génère un state aléatoire de 32 octets et le stocke dans la table
   `oauth_states` (service role uniquement, expiration 10 min), lié à
   l'utilisateur connecté ;
2. le provider renvoie ce state dans le callback ;
3. le callback le **consomme atomiquement** (une seule UPDATE possible) :
   replay impossible, state expiré refusé, state lié à un autre utilisateur
   refusé.

**SQL requis** : exécutez `supabase/oauth-states.sql`. Sans lui, le bouton
« Connecter » affiche une erreur explicite (aucun faux succès).

## 3. Apple / iCloud — abonnement ICS

Il n'existe **pas** d'API OAuth officielle pour iCloud Calendar accessible depuis
une PWA. La méthode officiellement compatible est l'**abonnement ICS** :
1. Sur iCloud.com → Calendrier → paramètres → **Partager un calendrier → URL publique**.
2. Dans Paramètres → Calendriers connectés → « Apple / iCloud · ICS », collez l'URL
   publique du flux `.ics` (bouton **S'abonner**). L'URL est validée (https
   uniquement), le flux est téléchargé et parsé immédiatement : une erreur est
   affichée si le flux n'est pas un calendrier valide.
3. Kininaru importe les événements en lecture seule via la route de
   synchronisation (bouton **Synchroniser**). Les calendriers partagés privés
   peuvent nécessiter un flux servi via une URL authentifiée. Les événements
   récurrents et les décalages VTIMEZONE ne sont pas importés (documenté dans
   `lib/calendar/ics.ts`).

## 4. Déduplication et atomicté (§28.6, §28.9)

`calendar_synced_events` mappe `(connection_id, external_event_id)` → événement
Kininaru avec `unique (connection_id, external_event_id)`. Un événement externe
est donc importé **une seule fois**, même après plusieurs synchronisations ou une
reconnexion.

Tout l'import se fait dans **une seule transaction PostgreSQL** (RPC
`calendar_import_events`, `supabase/calendar-sync-rpc.sql`) : événement créé +
mapping créé ensemble, ou rien — plus jamais d'événement orphelin. Le RPC
supprime aussi, **dans la fenêtre synchronisée uniquement** (7 j passés →
2 mois à venir), les événements qui ont disparu chez le fournisseur : un
événement supprimé côté Google/Outlook disparaît donc de Kininaru, tandis qu'un
événement passé hors fenêtre n'est jamais supprimé (on ne détruit pas
l'historique). La déconnexion du calendrier supprime les événements importés
automatiquement.

**SQL requis** : exécutez `supabase/calendar-sync-rpc.sql`. Sans lui, la
synchronisation renvoie une erreur explicite (jamais un faux succès).

## 5. Conflits (§28.8)

Résolution documentée (jamais d'écrasement silencieux) :
1. **Modifié ailleurs** → la version externe gagne pour les champs synchronisés,
   l'événement Kininaru est mis à jour et `last_synced_at` reflète la date.
2. **Modifié simultanément** → les deux sources restent cohérentes : la
   prochaine synchronisation réconcilie les champs synchronisés ; `sync_error`
   affiche l'avertissement le cas échéant.
3. **Supprimé ailleurs** → l'événement est retiré de Kininaru s'il est dans la
   fenêtre synchronisée ; hors fenêtre, il reste conservé (jamais de
   suppression d'historique).
4. **Calendrier inaccessible / token expiré** → `sync_error` est renseigné dans
   l'UI ; les événements déjà synchronisés restent consultables hors ligne.

## 6. Hors ligne (§28.9)

Les événements déjà synchronisés sont consultables hors ligne (données déjà
chargées). Les nouvelles modifications hors ligne passent par la file de
synchronisation générale (`lib/offline/sync-queue.ts`) et sont rejouées à la
reconnexion. L'état affiché est « Hors ligne · dernière synchronisation : … ».

## 7. Sécurité (§28.14)

- Aucun mot de passe n'est jamais stocké — OAuth uniquement.
- **Exécutez `supabase/calendar-security.sql`** : il révoque TOUT accès client
  aux tables `calendar_connections` / `calendar_synced_events` et expose une
  fonction `my_calendar_connections()` qui ne renvoie que les champs sûrs
  (id, provider, display_name, sync_mode, enabled, last_sync_at, sync_error,
  created_at) — les tokens ne peuvent PAS sortir vers le navigateur, quelle que
  soit la requête.
- Toutes les opérations (connecter, synchroniser, déconnecter, s'abonner ICS)
  passent par les routes API serveur (session requise, service role).
- Les tokens sont rafraîchis automatiquement (access expiré → refresh token).
  En production, chiffrez-les avec **Supabase Vault** (recommandé — voir
  `supabase/calendar-vault.sql`, disponible sur les plans avec l'extension
  `supabase_vault`). Les tokens ne sortent jamais du serveur dans tous les cas.

## Variables d'environnement (récapitulatif)

| Variable | Public ? | Rôle |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | oui | ID client OAuth Google (public par nature) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | non | Secret Google — serveur uniquement |
| `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` | oui | ID client Azure AD |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | non | Secret Microsoft — serveur uniquement |
