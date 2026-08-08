# Checklist de mise en production — Kininaru Planner

Ce document résume l'audit effectué, ce qui a été corrigé automatiquement, et ce qu'il vous reste à faire
manuellement (comptes tiers, textes légaux, clés). Rien n'a été supprimé ni cassé sans explication —
chaque changement de code est commenté à l'endroit où il a été fait.

## 1. Ce qui a été corrigé dans le code

- **Faille XSS dans l'assistant IA** (`app/(app)/ai/ai-client.tsx`) : le texte du modèle était injecté en
  HTML brut via `dangerouslySetInnerHTML` sans échappement. N'importe quel `<`, `>` ou balise renvoyée par
  le modèle (y compris via une tentative d'injection de prompt) s'exécutait comme du vrai HTML. Corrigé :
  le texte est maintenant échappé avant l'ajout du `**gras**`.
- **Route `/api/chat` non protégée** (`app/api/chat/route.ts`) : n'importe qui, même déconnecté, pouvait
  appeler cette route et consommer votre quota Gemini. Elle exige maintenant une session Supabase valide, et
  limite l'historique envoyé au modèle à 40 messages.
- **Middleware d'authentification** (`lib/supabase/proxy.ts`, exécuté via `proxy.ts` — nom correct pour
  Next.js 16, qui a renommé `middleware.ts` en `proxy.ts`) : mis à jour pour laisser les nouvelles pages
  publiques `/legal/*` accessibles sans connexion.
- **Bouton "Changer le mot de passe"** (Paramètres) : ne faisait rien avant. Il envoie maintenant un vrai
  e-mail de réinitialisation. Un lien "Mot de passe oublié ?" a aussi été ajouté à l'écran de connexion, et
  deux pages manquantes (`/auth/forgot-password`, `/auth/reset-password`) ont été créées pour compléter le
  parcours.
- **Interrupteurs de notifications** (Paramètres) : purement décoratifs avant (aucun état, aucune
  sauvegarde). Ils persistent maintenant réellement dans une nouvelle colonne `profiles.notification_prefs`
  (voir migration SQL section 3).
- **Suppression de compte** : n'existait pas du tout. Ajoutée dans Paramètres ("Zone de danger", avec
  confirmation obligatoire en tapant SUPPRIMER) et sur une page publique dédiée
  `/legal/suppression-compte` (exigée par les règles Google Play / App Store même sans connexion).
- **Écran de connexion resté en anglais** : traduit en français par cohérence avec le reste de
  l'application (qui est en français).
- **`package.json`** : le paquet `shadcn` (un outil CLI de développement) était classé dans les dépendances
  de production au lieu des dépendances de développement. Corrigé. → Après avoir récupéré ces fichiers,
  relancez `pnpm install` pour rafraîchir `pnpm-lock.yaml` (le lockfile n'a pas pu être régénéré ici).
- **`.gitignore` absent** : créé. Sans lui, `node_modules/`, `.next/` et surtout **`.env.local` avec vos
  vraies clés** pouvaient être commités par accident.
- **`.env.example`** ajouté (sans secrets réels) pour documenter les variables attendues.
- **`manifest.json` et `robots.txt`** absents : ajoutés (voir limites en section 5).

## 2. Ce qui a été vérifié et n'a PAS eu besoin de changement

- **Google Sign-In** : déjà implémenté correctement (`components/auth/google-auth-button.tsx`,
  `app/auth/callback/route.ts`, flux OAuth via Supabase). Il ne vous reste que la configuration côté
  Google Cloud / Supabase (section 3).
- **Règles RLS** (`supabase/schema.sql`) : chaque table (`profiles`, `tasks`, `events`, `habits`,
  `habit_logs`, `journal_entries`, `focus_sessions`) a des policies select/insert/update/delete correctement
  scopées à `auth.uid()`. Aucune faille trouvée.
- **Fichiers inutilisés** : recherche faite sur tous les composants — aucun fichier orphelin trouvé, rien à
  supprimer.
- **Clé Gemini** : n'est utilisée que côté serveur (`app/api/chat/route.ts`), jamais exposée au navigateur.
  Bien scopée dès le départ.

## 3. À faire manuellement avant publication (obligatoire)

### Sécurité / secrets
- [ ] **Faites tourner (régénérez) la clé `GEMINI_API_KEY`** si ce dossier a déjà été partagé ou poussé sur un dépôt public : dès
  qu'une clé secrète circule dans un export de projet, considérez-la comme potentiellement compromise.
  Idem pour toute autre clé si ce dossier a déjà été partagé ou poussé sur un dépôt public.
- [ ] Si ce projet a déjà été commité sur Git **sans** `.gitignore`, vérifiez l'historique (`git log -p --
  .env.local`) et purgez-le (`git filter-repo` ou BFG) en plus de régénérer les clés.
- [ ] Configurez les variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `GEMINI_API_KEY`) dans les paramètres de votre hébergeur (Vercel, etc.) — jamais via un fichier commité.
- [ ] Vérifiez qu'aucune variable `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` n'est définie en production
  (`app/auth/sign-up/page.tsx` l'utilise en priorité si elle existe — utile en dev, dangereux si oubliée en
  prod car elle redirigerait les e-mails de confirmation vers une URL de dev).

### Supabase
- [ ] Exécutez `supabase/schema.sql` puis `supabase/production_readiness.sql` (nouveau) dans le SQL Editor
  du projet Supabase de **production** (pas seulement celui de dev).
- [ ] Dashboard Supabase → Authentication → URL Configuration : renseignez le vrai domaine de production
  dans "Site URL" et ajoutez `https://votredomaine.com/auth/callback` aux Redirect URLs.
- [ ] Dashboard Supabase → Authentication → Providers → Google : activez le provider et renseignez le
  Client ID / Client Secret obtenus depuis Google Cloud Console (étape suivante).
- [ ] Vérifiez que "Confirm email" est activé (Authentication → Providers → Email) si vous voulez exiger la
  vérification d'e-mail avant connexion.

### Google Sign-In (Google Cloud Console)
- [ ] Créez (ou vérifiez) un écran de consentement OAuth. **Google exige une URL de politique de
  confidentialité publique** pour publier l'écran de consentement en production — utilisez
  `https://votredomaine.com/legal/confidentialite` une fois déployé.
- [ ] Ajoutez l'URI de redirection Supabase (`https://<votre-ref>.supabase.co/auth/v1/callback`) dans les
  "Authorized redirect URIs" du client OAuth Google.
- [ ] Passez l'écran de consentement de "Test" à "En production" une fois prêt (sinon seuls les comptes
  Google que vous avez explicitement autorisés pourront se connecter).

### Textes légaux
- [ ] Trois pages ont été créées comme **modèles** (pas des textes juridiques finalisés) :
  `/legal/confidentialite`, `/legal/conditions`, `/legal/suppression-compte`. Remplacez chaque
  `[À COMPLÉTER]` (nom légal de l'éditeur, adresse, e-mail de contact, juridiction, délais) et faites
  relire le résultat — idéalement par un professionnel du droit. Je ne suis pas juriste et ce contenu ne
  constitue pas un conseil juridique.
- [ ] Une fois les e-mails de contact réels renseignés, mettez aussi à jour le message d'erreur de secours
  dans `app/legal/suppression-compte/page.tsx` (`[À COMPLÉTER — e-mail de support]`).

### PWA (objectif mentionné pour le projet, actuellement incomplet)
- [ ] `manifest.json` créé, mais il manque des icônes carrées 192×192 et 512×512 (idéalement en version
  "maskable") — seules des icônes 32×32 et 180×180 existaient. Sans elles, Chrome/Android n'affichera pas
  toujours l'invite d'installation.
- [ ] Aucun service worker : l'app n'est pas encore installable "hors-ligne". Si le mode offline est
  toujours souhaité, il faudra ajouter un plugin dédié (ex. `@ducanh2912/next-pwa`) — travail non inclus
  ici pour ne pas modifier votre pipeline de build sans validation préalable.

### Build / qualité
- [ ] `next.config.mjs` a `typescript: { ignoreBuildErrors: true }` : les erreurs TypeScript sont
  actuellement **silencieusement ignorées** au build. Je n'ai pas désactivé cette option moi-même (je ne
  peux pas garantir ici qu'aucune erreur TS existante ne bloquerait votre build). Avant publication :
  passez-la à `false` localement, lancez `pnpm build`, et corrigez ce qui remonte.
- [ ] Lancez `pnpm install` après avoir récupéré ces fichiers (lockfile à rafraîchir suite au changement
  dans `package.json`), puis `pnpm build` pour valider que tout compile.
- [ ] Testez manuellement le parcours complet une fois déployé : inscription e-mail, connexion Google,
  mot de passe oublié → reset, suppression de compte (sur un compte de test, pas le vôtre).

### Divers
- [ ] Renseignez le `Sitemap:` dans `public/robots.txt` une fois le domaine de production connu.
- [ ] Vérifiez les limites de taux (rate limits) côté Supabase Auth et Google Gemini pour anticiper les pics
  d'usage.

## 4. Fichiers ajoutés ou modifiés dans cette passe

```
NOUVEAUX
  .gitignore
  .env.example
  supabase/production_readiness.sql
  app/auth/forgot-password/page.tsx
  app/auth/reset-password/page.tsx
  app/legal/confidentialite/page.tsx
  app/legal/conditions/page.tsx
  app/legal/suppression-compte/page.tsx
  components/legal/legal-page-shell.tsx
  public/manifest.json
  public/robots.txt
  PRODUCTION_CHECKLIST.md

MODIFIÉS
  app/api/chat/route.ts               (auth requise + limite d'historique)
  app/(app)/ai/ai-client.tsx          (correction XSS)
  app/(app)/settings/settings-client.tsx  (mot de passe, notifications, suppression de compte)
  app/auth/login/page.tsx             (lien mot de passe oublié, traduction, redirection ?next=)
  lib/supabase/proxy.ts               (pages /legal publiques)
  components/landing/landing-footer.tsx   (liens légaux réels)
  app/layout.tsx                      (référence au manifest.json)
  package.json                        (shadcn déplacé en devDependencies)
```

## 5. Limites connues de cet audit

- Je n'ai pas pu exécuter `pnpm install` / `pnpm build` dans cet environnement (pas d'accès à un
  gestionnaire de paquets pnpm ici) : les changements ont été relus attentivement mais pas compilés. Faites
  tourner `pnpm build` avant de déployer.
- L'audit a couvert l'authentification, les routes API, le middleware, les RLS, les secrets et les
  fonctionnalités manquantes explicitement demandées. Je n'ai pas relu ligne par ligne chaque page
  fonctionnelle (calendrier, habitudes, journal, analytics) à la recherche de bugs métier fins — seulement
  les éléments transverses de sécurité/production.
