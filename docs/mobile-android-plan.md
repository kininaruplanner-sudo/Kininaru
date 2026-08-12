# Kininaru — Plan d'architecture Android / Google Play

> Document de décision. Aucun code applicatif n'a été modifié pour produire ce plan :
> il décrit l'état actuel, compare les stratégies et liste les fichiers à créer/modifier.
> Version : août 2026 — dépôt Kininaru.

---

## 1. Étape 1 — Audit de l'application actuelle (état mobile/PWA)

Kininaru est aujourd'hui une **application web Next.js 16 (App Router) pleinement fonctionnelle**,
hébergée sur Vercel, avec un socle PWA déjà solide. Ce qui existe déjà, vérifié dans le code :

### ✅ Déjà en place (à conserver tel quel)

| Domaine | État | Preuve dans le code |
|---|---|---|
| **PWA installable** | `manifest.webmanifest` complet : `standalone`, `portrait`, icônes 192/512 + **maskable 512**, `theme_color` | `app/manifest.ts` |
| **Service worker** | Enregistré en production uniquement (`/sw.js`) ; assets statiques en *stale-while-revalidate* ; **aucune donnée privée jamais mise en cache** (choix sécurité documenté) ; page « hors ligne » honnête | `public/sw.js`, `components/sw-register.tsx` |
| **Web Push** | Bout en bout : abonnement (`/api/push/subscribe`), envoi chiffré côté serveur (`web-push` + VAPID), affichage par le SW, **clic → navigation (deep link)** | `public/sw.js` (handlers `push`/`notificationclick`), `lib/web-push/*`, `app/api/push/*` |
| **Préférences de notifications** | Types (matin / soir / semaine / coach), **fréquence faible–normale–élevée (3/6/10 par jour)**, **heures silencieuses**, pause 24 h, test, désactivation complète | `components/push-settings-panel.tsx`, `lib/web-push/client.ts` |
| **Deep links** | Routes profondes fonctionnelles, dont **`/focus?taskId=…&task=…` (Focus pré-rempli)** et `/tasks?new=1` | Routes `app/(app)/*` |
| **Sécurité des secrets** | `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `CRON_SECRET` : **côté serveur uniquement** (Next API routes). Aucune clé dans le client | `lib/web-push/server.ts`, `lib/ai/*`, `app/api/*` |
| **IA** | Toutes les requêtes Groq passent par les API routes serveur ; aucun secret client | `app/api/chat`, `app/api/ai/actions`, `lib/ai-stream.ts` |
| **Engagement** | XP, niveau, succès (page `Achievements`), séries d'habitudes, score de productivité, progression hebdomadaire | `app/(app)/achievements/*`, `app/(app)/dashboard/*`, `app/(app)/analytics/*` |
| **Coach IA** | Bulle flottante discrète sur toutes les pages, observations **déterministes à partir des données réelles** (jamais inventées), gating de fréquence, briefs matin/soir/semaine | `components/coach/*`, `lib/coach/*`, `app/api/coach/*` |
| **Accessibilité / UX** | Zones tactiles ≥ 44 px (corrigé en audit précédent), `prefers-reduced-motion` global, focus visibles, thèmes clair/sombre | `components/ui/button.tsx`, `app/globals.css` |
| **Politique de confidentialité** | Présente (`/legal/confidentialite`) — prérequis Google Play | `app/legal/confidentialite/page.tsx` |

### ⚠️ Manques identifiés pour la distribution Android/Google Play

| # | Manque | Impact | Solution prévue |
|---|---|---|---|
| G1 | **Clés VAPID non configurées** en production (`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`) | Web Push inopérant en prod | Générer la paire VAPID et la poser dans Vercel (documenté README) — action utilisateur |
| G2 | **Pas de coquille Android** (TWA/Capacitor) : la PWA n'est pas encore empaquetée pour le Play Store | Impossible de publier sur Google Play | Voir architecture ci-dessous (Étape 2) |
| G3 | **Pas de `assetlinks.json`** (Digital Asset Links) | Impossible de lier domaine ↔ application Android (identité TWA) | À créer dans `public/` (Étape 3) |
| G4 | **Navigation mobile = drawer latéral**, pas de barre d'onglets basse | Moins confortable au quotidien sur téléphone | Barre d'onglets mobile (Accueil / Tâches / Focus / Journal / Coach) — Phase 2 |
| G5 | **Offline limité** à la page « hors ligne » honnête (choix sécurité) | Aucune consultation hors ligne | Optionnel : cache du shell public uniquement (jamais de données privées) |
| G6 | **Splash screen natif** absent (PWA affiche une page blanche au lancement) | Perception de lenteur | Splash configuré côté TWA/Capacitor |
| G7 | **Message « pas grave, on reprend »** (anti-culpabilisation après une journée manquée) non explicite | Ton du Coach | Ajout de ce ton dans les observations (Phase 2) |
| G8 | Formulaire **Data Safety** et compte Play Console non configurés | Bloquant pour la publication | Action utilisateur (liste en Étape 8) |

---

## 2. Étape 2 — Comparaison des architectures et recommandation

### Les 4 options techniques

| Critère | **A. TWA (Bubblewrap)** | B. Capacitor (Ionic) | C. React Native | D. Kotlin natif |
|---|---|---|---|---|
| **Code existant réutilisé** | **100 %** (l'app web EST l'app) | ~95 % (coquille native + web) | ~20 % (réécriture UI) | ~5 % (réécriture totale) |
| **Supabase / RLS / Auth** | ✅ inchangés | ✅ inchangés | ⚠️ réécriture des clients | ⚠️ réécriture |
| **APIs IA (Groq serveur)** | ✅ inchangées | ✅ inchangées | ⚠️ refonte | ⚠️ refonte |
| **Notifications natives** | ✅ Web Push (drawer Android, actionnables) | ✅ Web Push + **FCM + notifications locales planifiées** | ✅ FCM natif | ✅ FCM natif |
| **Deep links depuis notification** | ✅ (`/focus?taskId=…`, `/tasks`, `/journal`) | ✅ | ✅ | ✅ |
| **Hors connexion** | ⚠️ partiel (SW, posture sécurité actuelle) | ⚠️ partiel + plugins | ✅ complet | ✅ complet |
| **Google Play** | ✅ AAB via Bubblewrap | ✅ AAB natif | ✅ AAB natif | ✅ AAB natif |
| **Complexité / maintenance** | **Très faible** (zéro code applicatif) | Faible–moyenne (projet Android + plugins) | Élevée | Très élevée |
| **Risque de régression** | Quasi nul | Faible | Élevé | Très élevé |

### Recommandation : **Option A — PWA + TWA (Trusted Web Activity) via Bubblewrap**

**Pourquoi :**
1. **Réutilisation maximale** : l'application web actuelle devient l'application Android, sans une ligne de code dupliquée. Toutes les fonctionnalités existantes (Supabase, Auth/RLS, Groq, Coach, mémoire, tâches, habitudes, Focus, Journal, notifications) fonctionnent à l'identique.
2. **Notifications natives** : le Web Push existant affiche de vraies notifications Android (drawer, actions, clic → deep link). Le système de préférences (fréquence, heures silencieuses, types, pause, désactivation) est **déjà construit et respecté par le serveur**.
3. **Deep links** : déjà câblés dans le service worker (`notificationclick` → `client.navigate(link)`).
4. **Google Play** : Bubblewrap génère l'APK/AAB signé ; les exigences Play (politique de confidentialité existante, icônes existantes) sont couvertes.
5. **Coût/risque** : le plus faible de toutes les options — aucune modification de l'app web, aucune dette technique nouvelle.

**Alternative documentée (si les besoins évoluent) : Option B — Capacitor**, uniquement si une exigence future rend le Web Push insuffisant (ex. notifications locales planifiées sur l'appareil sans serveur, haptique, FCM). Le plan ci-dessous est conçu pour que cette bascule reste possible sans refonte (l'app web reste le cœur).

---

## 3. Étape 3 — Fichiers à créer ou modifier (par phase)

### Phase 0 — Prérequis (aucun code)
| Action | Détail |
|---|---|
| Générer la paire VAPID | `npx web-push generate-vapid-keys` → poser `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` + `WEB_PUSH_VAPID_PRIVATE_KEY` dans Vercel |
| Configurer `CRON_SECRET` | Valeur aléatoire forte (voir README) — requise par le cron des briefs |
| Compte Google Play | 25 $ une fois, console Play Console |
| Data Safety + politique | Lien vers `/legal/confidentialite`, formulaire de déclaration des données |

### Phase 1 — Préparation PWA (dépôt actuel)
| Fichier | Action |
|---|---|
| `public/.well-known/assetlinks.json` | **Créer** — Digital Asset Links (sha256 de la clé de signature Play ↔ `https://kininaru-planner.vercel.app`) |
| `app/manifest.ts` | Ajouter `launch_handler`/splash params éventuels ; vérifier `id` stable |
| `public/sw.js` | Optionnel : cache du shell public (landing, `/login`) — jamais de données privées |
| `docs/` (ce fichier) | Référencé depuis le README |

### Phase 2 — UX mobile (dépôt actuel)
| Fichier | Action |
|---|---|
| `components/sidebar.tsx` | Ajouter une **barre d'onglets basse mobile** (Accueil / Tâches / Focus / Journal / Coach) affichée < `md`, le drawer latéral restant pour les sections secondaires |
| `app/(app)/dashboard/dashboard-client.tsx` | Carte « Prochaine action » en tête (déjà fait) ; hiérarchie mobile : 🎯 action → ⏱ Focus → 🔥 habitudes → 📈 progression |
| `components/coach/coach-bubble.tsx` | Repositionner la bulle au-dessus de la barre d'onglets mobile ; message anti-culpabilisation (« Pas grave. On reprend aujourd'hui. ») quand aucune activité la veille |
| `lib/coach/rules.ts` | Règle « veille vide → ton bienveillant » (déterministe, aucune donnée inventée) |

### Phase 3 — Empaquetage Android (nouveau dossier, hors dépôt web ou sous `android/`)
| Fichier | Action |
|---|---|
| `bubblewrap.config.json` (ou `android/` généré) | Généré par `npx @bubblewrap/cli` : host `kininaru-planner.vercel.app`, `start_url /`, icônes PWA, splash |
| `android/app/build.gradle` | Signé (Play App Signing), `minSdk` recommandé 24+, `targetSdk` courant |
| `app.json` / `assetlinks.json` | Identité TWA ↔ domaine |

---

## 4. Étape 4 — Ce qui est partagé entre web et mobile

**Tout est partagé** : avec l'option TWA, mobile et web sont **la même application**, servie par le même déploiement Vercel.

- Composants UI : 100 % (les pages sont déjà responsive, zones tactiles ≥ 44 px)
- Supabase (client SSR + navigateur, RLS) : 100 %
- APIs IA serveur (Groq) : 100 %
- Web Push + préférences : 100 %
- Coach, mémoire, i18n (FR/EN), thèmes, PWA : 100 %

Aucune duplication de logique métier n'est nécessaire.

---

## 5. Étape 5 — Fonctionnalités nécessitant une adaptation native

| Fonctionnalité | Adaptation native nécessaire | Solution |
|---|---|---|
| Notifications | Affichage Android (déjà natif via Web Push) ; **clic → ouverture de l'app** (TWA gère) | SW existant + TWA |
| Deep links internes | Aucune — URLs relatives (`/focus?taskId=…`) | SW `notificationclick` existant |
| Splash screen | Bannière native au lancement | Bubblewrap (icône + couleur de fond) |
| Haptique / vibration (optionnel) | Retour tactile à la fin d'un Focus | `navigator.vibrate()` (WebView) — Phase 2, optionnel |
| Hors connexion | Cache du shell uniquement (jamais de données privées) | SW existant, étendu au shell public |
| Partage Android (intent « Partager → Kininaru ») | Recevoir du texte externe (optionnel) | Phase 2 optionnelle (Web Share Target dans le manifest) |

---

## 6. Étape 6 — Notifications intelligentes et deep links

### Système existant (à conserver, complété)
```
Création d'une tâche importante
        ↓
Cron serveur /api/cron/briefs (7 h, 20 h, lundi 8 h UTC)
        ↓
Règles serveur : fréquence (3/6/10 par jour), heures silencieuses,
types cochés, plafond journalier (push_send_log), déduplication par jour
        ↓
Payload chiffré → SW → notification Android
        ↓
Clic → notificationclick → navigate(link) → app ouverte → action immédiate
```

### Cibles de deep link (déjà routées)
| Notification | Lien | Écran cible |
|---|---|---|
| « 🎯 20 minutes de maths ? » | `/focus?taskId=<id>&task=Réviser les maths` | **Focus pré-rempli → [Commencer]** |
| Rappel de tâche prioritaire | `/tasks` (ou `/tasks?focus=<id>` plus tard) | Liste filtrée |
| Bilan du soir | `/journal` | Journal du jour |
| Habitude non cochée | `/habits` | Check-in |
| Brief du matin | `/dashboard` | Prochaine action |
| Bilan hebdo | `/ai` | Conversation coach |

### Nouveaux types de notifications (Phase 2, côté serveur — jamais inventés)
1. Rappel de tâche importante (échéance ≤ 24 h ou dépassée) — **« pas grave »** si échouée : message bienveillant
2. Proposition de **session Focus** (tâche prioritaire sans créneau) → deep link Focus prérempli
3. Encouragement après progression (≥ 2 tâches ou 1 Focus terminé aujourd'hui)
4. Résumé de journée (bilan du soir — existe)
5. Rappel d'habitude (non cochée à une heure raisonnable)
6. Bilan hebdomadaire (existe)

**Garde-fous** : chaque type respecte le plafond quotidien, la fréquence, les heures silencieuses, la pause 24 h et la désactivation complète — tous déjà implémentés côté serveur.

---

## 7. Étape 7 — Parcours mobile complet (installation → bilan)

1. **Installation** : depuis le Play Store (AAB TWA) → icône + splash → lancement
2. **Inscription** : `/auth/sign-up` (email/mot de passe ou Google OAuth — Supabase inchangé)
3. **Onboarding** : carte « Bienvenue sur Kininaru » (déjà implémentée) → 3 étapes guidées
4. **Première tâche** : `/tasks?new=1` (pré-rempli via deep link du dashboard)
5. **Première action** : le Coach propose « 🎯 Prêt pour 20 minutes ? » (déterministe, données réelles)
6. **Focus** : `/focus?taskId=…&task=…` pré-rempli → [Commencer] → session → chime + « ✓ Session terminée. Tu as avancé aujourd'hui. »
7. **Progression** : score, XP, séries, succès (existant) — **ton bienveillant si une journée est manquée**
8. **Notification** : rappel utile (type configurable, fréquence respectée)
9. **Retour** : clic → deep link → écran exact avec l'action disponible
10. **Bilan** : résumé de journée (soir) + préparation du lendemain

---

## 8. Prérequis Google Play (action utilisateur, sans code)

1. Compte développeur Google Play (25 $ unique)
2. Vérifier l'**App Signing** (clé de signature → sha256 → `assetlinks.json`)
3. Renseigner la **Data Safety** (authentification, données utilisateur, IA tierce Groq, analytics)
4. Lier la **politique de confidentialité** (`https://kininaru-planner.vercel.app/legal/confidentialite`) et les **conditions d'utilisation**
5. Vérifier que les **clés VAPID + CRON_SECRET** sont en place sur Vercel (G1)

---

## 9. Résumé de la feuille de route

| Phase | Contenu | Effort | Dépend de |
|---|---|---|---|
| **0** | Clés VAPID + CRON_SECRET + compte Play | Utilisateur | — |
| **1** | `assetlinks.json`, réglages manifest, README | Faible (dépôt web) | Phase 0 |
| **2** | Barre d'onglets mobile, hiérarchie dashboard, ton bienveillant Coach | Moyen (dépôt web) | — |
| **3** | Bubblewrap → projet Android → AAB signé → test Play | Moyen (hors dépôt web) | Phase 1 + clé de signature |

**Décision clé** : aucune modification de l'application web n'est *nécessaire* pour être distribuable — la PWA actuelle est déjà installable et le Web Push est prêt. Les phases 1–2 améliorent l'expérience mobile ; la phase 3 est l'empaquetage Play.

---

*Document de travail — à relire avant le démarrage de la Phase 1. Aucun secret n'est décrit ici ; toutes les clés restent côté serveur/Vercel.*
