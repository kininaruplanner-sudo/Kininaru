'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Locale = 'fr' | 'en'

/**
 * Lightweight i18n for Kininaru.
 *
 * Design decisions:
 * - Two dictionaries (fr / en) with the exact same keys — TypeScript enforces
 *   parity by typing `en` as a record over the `fr` keys.
 * - French is the original language and the default.
 * - Locale persists in localStorage (`kininaru-locale`) and is applied to
 *   <html lang> so screen readers and hyphenation follow the choice.
 * - `t()` falls back to the raw key when a translation is missing, so a
 *   forgotten key degrades to something visible rather than crashing.
 *
 * Scope note: the whole codebase isn't migrated in one pass. This provides the
 * infrastructure plus the migration of the app chrome (sidebar, settings,
 * auth flows, notifications). Feature pages can adopt `t()` progressively.
 */

const fr = {
  // Nav / chrome
  'nav.dashboard': 'Dashboard',
  'nav.calendar': 'Calendrier',
  'nav.tasks': 'Tâches',
  'nav.focus': 'Focus',
  'nav.habits': 'Habitudes',
  'nav.journal': 'Journal',
  'nav.family': 'Famille',
  'nav.analytics': 'Analyses',
  'nav.achievements': 'Récompenses',
  'nav.ai': 'Assistant IA',
  'common.search': 'Rechercher...',
  'common.settings': 'Paramètres',
  'common.signOut': 'Se déconnecter',
  'common.openMenu': 'Ouvrir le menu',
  'nav.group.space': 'Espace',
  'nav.group.together': 'Ensemble',

  // Notifications
  'notif.title': 'Notifications',
  'notif.unread': 'non lues',
  'notif.empty': 'Aucune notification',
  'notif.markAll': 'Tout marquer comme lu',
  'notif.loading': 'Chargement...',

  // Settings
  'settings.title': 'Paramètres',
  'settings.subtitle': 'Gérez votre compte et vos préférences',
  'settings.profile': 'Compte',
  'settings.profileDesc': 'Vos informations personnelles',
  'settings.displayName': 'Nom affiché',
  'settings.displayNamePlaceholder': 'Votre nom',
  'settings.email': 'Email',
  'settings.save': 'Enregistrer',
  'settings.saving': 'Enregistrement...',
  'settings.saved': 'Enregistré !',
  'settings.appearance': 'Apparence',
  'settings.theme': 'Thème',
  'settings.notifications': 'Notifications',
  'settings.notificationsSoon': 'À venir',
  'settings.notifTask': 'Rappels de tâches',
  'settings.notifTaskDesc': 'Soyez notifié des échéances à venir',
  'settings.notifHabit': 'Rappels d’habitudes',
  'settings.notifHabitDesc': 'Des rappels quotidiens pour vos habitudes',
  'settings.notifFocus': 'Fin de session Focus',
  'settings.notifFocusDesc': 'Alerte quand une session Pomodoro se termine',
  'settings.pwTooShort': 'Le mot de passe doit contenir au moins 6 caractères.',
  'settings.pwMismatch': 'Les deux mots de passe ne correspondent pas.',
  'settings.pwUpdated': 'Mot de passe mis à jour avec succès.',
  'settings.pwError': 'Impossible de changer le mot de passe. Réessayez dans un instant.',
  'settings.security': 'Sécurité',
  'settings.securityDesc':
    'Votre compte est protégé par Supabase Auth. Modifiez votre mot de passe ci-dessous.',
  'settings.newPassword': 'Nouveau mot de passe',
  'settings.confirmPassword': 'Confirmer le mot de passe',
  'settings.changePassword': 'Changer le mot de passe',
  'settings.installation': 'Préférences',
  'settings.installBrowser':
    "L'installation est disponible via le menu de votre navigateur (icône d'installation dans la barre d'adresse, le cas échéant).",
  'settings.installIos':
    "Sur iPhone/iPad : menu Partager → « Ajouter à l'écran d'accueil ».",
  'settings.installButton': 'Installer Kininaru',
  'settings.installed': 'Kininaru est installé sur cet appareil.',
  'install.cardTitle': '📲 Installer Kininaru',
  'install.cardDesc': 'Utilisez Kininaru comme une vraie application, avec une icône sur votre appareil.',
  'install.bannerTitle': 'Kininaru fonctionne mieux comme une application.',
  'install.bannerDesc': 'Installez Kininaru pour un accès direct, rapide et sans onglet de navigateur.',
  'install.browserHint':
    "Pour installer Kininaru, utilisez l'option « Installer » de votre navigateur (icône d'installation dans la barre d'adresse).",
  'install.dismiss': 'Plus tard',
  'install.installedOn': 'Kininaru est installé sur cet appareil ✓',
  'settings.language': 'Langue',
  'settings.languageDesc': 'Choisissez la langue de l’application.',
  'settings.voiceCall': 'Appel vocal',
  'settings.voiceCallDesc':
    'Personnalisez la voix, le débit et le volume du coach pendant les appels vocaux. Ces réglages sont propres à cet appareil.',
  'settings.voiceLabel': 'Voix du coach',
  'settings.voiceAuto': 'Auto (recommandé)',
  'settings.voiceNoVoices': 'Aucune voix disponible sur cet appareil.',
  'settings.voiceRate': 'Débit',
  'settings.voiceVolume': 'Volume',
  'settings.voiceTest': 'Tester la voix',
  'settings.voiceTestAgain': 'Tester à nouveau',
  'settings.voiceSample': 'Bonjour ! Je suis le coach Kininaru. Voici à quoi je ressemble.',

  // Coach IA (ÉTAPE 14)
  'settings.coach': 'Coach IA',
  'settings.coachDesc': 'Votre compagnon quotidien — observations, rappels et bilans',
  'settings.coachEnabled': 'Coach IA',
  'settings.coachEnabledDesc': 'Affiche le coach flottant sur toutes les pages',
  'settings.coachProactive': 'Commentaires proactifs',
  'settings.coachProactiveDesc': 'Le coach commente votre journée avec des règles locales, sans appels IA inutiles',
  'settings.coachNotif': 'Notifications',
  'settings.coachNotifDesc': 'Cloche in-app + notifications système pour les moments importants',
  'settings.coachNotifExplain': 'La permission n’est demandée que si vous l’activez ici — jamais au premier chargement.',
  'settings.coachNotifAllow': 'Autoriser les notifications',
  'settings.coachNotifBlocked': 'Notifications bloquées par le navigateur. Autorisez-les dans les réglages du site.',
  'settings.coachNotifUnsupported': 'Notifications non prises en charge par ce navigateur.',
  'settings.coachDaily': 'Bilan quotidien',
  'settings.coachDailyDesc': 'Bilan de fin de journée',
  'settings.coachWeekly': 'Bilan hebdomadaire',
  'settings.coachWeeklyDesc': 'Résumé de la semaine',
  'settings.coachStyle': 'Style du Coach',
  'settings.coachStyleCalm': 'Calme',
  'settings.coachStyleEncouraging': 'Encourageant',
  'settings.coachStyleDirect': 'Direct',
  'settings.coachStyleConcise': 'Concis',
  'settings.coachFrequency': 'Fréquence des interventions',
  'settings.coachFrequencyDesc': 'À quelle fréquence le coach peut-il commenter votre journée ? Les heures de repos et la pause restent toujours respectées.',
  'settings.coachFrequencyLow': 'Faible',
  'settings.coachFrequencyLowDesc': '3 max/jour',
  'settings.coachFrequencyNormal': 'Normale',
  'settings.coachFrequencyNormalDesc': '6 max/jour',
  'settings.coachFrequencyHigh': 'Élevée',
  'settings.coachFrequencyHighDesc': '10 max/jour',
  'settings.coachPause': 'Mettre en pause 24 h',
  'settings.coachPausedUntil': 'En pause jusqu’à {time}',
  'settings.coachResume': 'Reprendre',
  'settings.coachReset': 'Réinitialiser',
  'settings.coachPrivacy': 'Le coach voit un résumé de votre journée (tâches, habitudes, événements, focus). Il ne lit pas vos secrets et n’appelle l’IA que lorsque vous lui parlez.',
  'settings.ia': 'Intelligence artificielle',
  'settings.iaDesc': 'Kininaru est propulsé par Groq (gpt-oss-120b, hébergé par Groq). Vos messages sont envoyés au modèle uniquement pour générer des réponses — jamais vendus ni partagés.',
  'settings.memory': 'Mémoire de l\'assistant',
  'settings.memoryDesc': 'Les faits que l\'assistant a mémorisés avec votre accord (objectifs, préférences, contraintes) pour personnaliser ses réponses. Strictement privés : utilisés uniquement comme contexte pour vos conversations, jamais partagés. Vous pouvez les supprimer à tout moment.',
  'settings.memoryEmpty': 'Aucune mémoire enregistrée. L\'assistant vous proposera de mémoriser un fait durable quand cela peut vous aider — vous restez libre de confirmer ou refuser.',
  'settings.memoryDelete': 'Supprimer cette mémoire',
  'settings.deleteAccount': 'Suppression du compte',
  'settings.deleteAccountDesc': 'Vous pouvez supprimer votre compte et toutes vos données à tout moment. Cette action est définitive et irréversible.',
  'settings.deleteAccountLink': 'Demander la suppression de mon compte',

  // Auth
  'auth.loginTitle': 'Bon retour',
  'auth.loginSubtitle': 'Connectez-vous pour continuer sur Kininaru',
  'auth.signIn': 'Se connecter',
  'auth.signingIn': 'Connexion...',
  'auth.or': 'ou',
  'auth.google': 'Continuer avec Google',
  'auth.redirecting': 'Redirection...',
  'auth.noAccount': 'Pas encore de compte ? ',
  'auth.signUp': "S'inscrire",
  'auth.forgotPassword': 'Mot de passe oublié ?',
  'auth.email': 'Email',
  'auth.password': 'Mot de passe',
  'auth.createAccount': 'Créez votre compte',
  'auth.createSubtitle': 'Commencez votre aventure avec Kininaru',
  'auth.displayName': 'Nom affiché',
  'auth.namePlaceholder': 'Votre nom',
  'auth.minChars': 'Au moins 6 caractères',
  'auth.creating': 'Création du compte...',
  'auth.haveAccount': 'Déjà un compte ? ',
  'auth.signInLink': 'Se connecter',
  'auth.forgotTitle': 'Mot de passe oublié ?',
  'auth.forgotSubtitle': 'Entrez votre email et nous vous enverrons un lien de réinitialisation.',
  'auth.sendReset': 'Envoyer le lien',
  'auth.sending': 'Envoi...',
  'auth.backToLogin': 'Retour à la connexion',
  'auth.checkEmail': 'Vérifiez votre email',
  'auth.resetSent':
    'Si un compte existe pour {email}, un lien de réinitialisation vient d’être envoyé. Vérifiez votre boîte de réception (et vos spams).',
  'auth.resetTitle': 'Définir un nouveau mot de passe',
  'auth.resetSubtitle': 'Choisissez un nouveau mot de passe pour votre compte.',
  'auth.newPassword': 'Nouveau mot de passe',
  'auth.confirmPassword': 'Confirmer le mot de passe',
  'auth.updatePassword': 'Mettre à jour le mot de passe',
  'auth.updating': 'Mise à jour...',
  'auth.passwordUpdated': 'Mot de passe mis à jour',
  'auth.redirectingToLogin': 'Redirection vers la connexion...',
  'auth.authError': 'Erreur d’authentification',
  'auth.authErrorDesc': 'Une erreur est survenue pendant l’authentification. Veuillez réessayer.',
  'auth.signUpSuccessTitle': 'Vérifiez votre email',
  'auth.signUpSuccessDesc':
    "Nous vous avons envoyé un email de confirmation. Cliquez sur le lien pour vérifier votre compte et terminer votre inscription.",
  'auth.googleFailed': 'Échec de la connexion Google',
  'auth.configRequiredTitle': 'Configuration requise',
  'auth.configRequiredDesc':
    'Kininaru a besoin de vos identifiants Supabase pour fonctionner. Créez un fichier .env.local à la racine du projet avec ces variables :',
  'auth.configRequiredNote':
    'Les valeurs viennent de votre projet Supabase (Settings → API) et de votre compte Groq. Le guide complet est dans le README.md.',
  'auth.configRequiredHome': "Retour à l'accueil",
  'auth.configRequiredCopy': 'Copier',
  'auth.configRequiredCopied': 'Copié !',
} as const

export type TranslationKey = keyof typeof fr

const en: Record<TranslationKey, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.calendar': 'Calendar',
  'nav.tasks': 'Tasks',
  'nav.focus': 'Focus',
  'nav.habits': 'Habits',
  'nav.journal': 'Journal',
  'nav.family': 'Family',
  'nav.analytics': 'Analytics',
  'nav.achievements': 'Achievements',
  'nav.ai': 'AI Assistant',
  'common.search': 'Search...',
  'common.settings': 'Settings',
  'common.signOut': 'Sign out',
  'common.openMenu': 'Open menu',
  'nav.group.space': 'Workspace',
  'nav.group.together': 'Together',

  'notif.title': 'Notifications',
  'notif.unread': 'unread',
  'notif.empty': 'No notifications',
  'notif.markAll': 'Mark all as read',
  'notif.loading': 'Loading...',

  'settings.title': 'Settings',
  'settings.subtitle': 'Manage your account and preferences',
  'settings.profile': 'Account',
  'settings.profileDesc': 'Your personal information',
  'settings.displayName': 'Display name',
  'settings.displayNamePlaceholder': 'Your name',
  'settings.email': 'Email',
  'settings.save': 'Save changes',
  'settings.saving': 'Saving...',
  'settings.saved': 'Saved!',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.notifications': 'Notifications',
  'settings.notificationsSoon': 'Coming soon',
  'settings.notifTask': 'Task reminders',
  'settings.notifTaskDesc': 'Get notified about upcoming deadlines',
  'settings.notifHabit': 'Habit reminders',
  'settings.notifHabitDesc': 'Daily nudges for your habits',
  'settings.notifFocus': 'Focus session end',
  'settings.notifFocusDesc': 'Alert when a Pomodoro session ends',
  'settings.pwTooShort': 'The password must be at least 6 characters long.',
  'settings.pwMismatch': 'The two passwords do not match.',
  'settings.pwUpdated': 'Password updated successfully.',
  'settings.pwError': 'Unable to change the password. Please try again in a moment.',
  'settings.security': 'Security',
  'settings.securityDesc':
    'Your account is protected with Supabase Auth. Change your password below.',
  'settings.newPassword': 'New password',
  'settings.confirmPassword': 'Confirm password',
  'settings.changePassword': 'Change password',
  'settings.installation': 'Preferences',
  'settings.installBrowser':
    'Installation is available from your browser menu (install icon in the address bar, where applicable).',
  'settings.installIos': 'On iPhone/iPad: Share menu → “Add to Home Screen”.',
  'settings.installButton': 'Install Kininaru',
  'settings.installed': 'Kininaru is installed on this device.',
  'install.cardTitle': '📲 Install Kininaru',
  'install.cardDesc': 'Use Kininaru like a real app, with its own icon on your device.',
  'install.bannerTitle': 'Kininaru works best as an app.',
  'install.bannerDesc': 'Install Kininaru for quick, direct access — no browser tab needed.',
  'install.browserHint':
    'To install Kininaru, use the “Install” option in your browser (install icon in the address bar).',
  'install.dismiss': 'Later',
  'install.installedOn': 'Kininaru is installed on this device ✓',
  'settings.language': 'Language',
  'settings.languageDesc': 'Choose the language of the app.',
  'settings.voiceCall': 'Voice call',
  'settings.voiceCallDesc':
    "Customize the coach's voice, speed and volume during voice calls. These settings are specific to this device.",
  'settings.voiceLabel': 'Coach voice',
  'settings.voiceAuto': 'Auto (recommended)',
  'settings.voiceNoVoices': 'No voices available on this device.',
  'settings.voiceRate': 'Speed',
  'settings.voiceVolume': 'Volume',
  'settings.voiceTest': 'Test voice',
  'settings.voiceTestAgain': 'Test again',
  'settings.voiceSample': 'Hello! I am the Kininaru coach. This is what I sound like.',

  // AI Coach (STEP 14)
  'settings.coach': 'AI Coach',
  'settings.coachDesc': 'Your daily companion — observations, reminders and reviews',
  'settings.coachEnabled': 'AI Coach',
  'settings.coachEnabledDesc': 'Show the floating coach on every page',
  'settings.coachProactive': 'Proactive comments',
  'settings.coachProactiveDesc': 'The coach comments on your day using local rules, without wasteful AI calls',
  'settings.coachNotif': 'Notifications',
  'settings.coachNotifDesc': 'In-app bell + system notifications for important moments',
  'settings.coachNotifExplain': 'Permission is only requested if you enable it here — never on first load.',
  'settings.coachNotifAllow': 'Allow notifications',
  'settings.coachNotifBlocked': 'Notifications blocked by the browser. Enable them in the site settings.',
  'settings.coachNotifUnsupported': 'Notifications are not supported by this browser.',
  'settings.coachDaily': 'Daily review',
  'settings.coachDailyDesc': 'End-of-day review',
  'settings.coachWeekly': 'Weekly review',
  'settings.coachWeeklyDesc': 'Weekly summary',
  'settings.coachStyle': 'Coach style',
  'settings.coachStyleCalm': 'Calm',
  'settings.coachStyleEncouraging': 'Encouraging',
  'settings.coachStyleDirect': 'Direct',
  'settings.coachStyleConcise': 'Concise',
  'settings.coachFrequency': 'Intervention frequency',
  'settings.coachFrequencyDesc': 'How often may the coach comment on your day? Quiet hours and the pause are always respected.',
  'settings.coachFrequencyLow': 'Low',
  'settings.coachFrequencyLowDesc': '3 max/day',
  'settings.coachFrequencyNormal': 'Normal',
  'settings.coachFrequencyNormalDesc': '6 max/day',
  'settings.coachFrequencyHigh': 'High',
  'settings.coachFrequencyHighDesc': '10 max/day',
  'settings.coachPause': 'Pause for 24 h',
  'settings.coachPausedUntil': 'Paused until {time}',
  'settings.coachResume': 'Resume',
  'settings.coachReset': 'Reset',
  'settings.coachPrivacy': 'The coach sees a summary of your day (tasks, habits, events, focus). It never reads your secrets and only calls the AI when you talk to it.',
  'settings.ia': 'Artificial intelligence',
  'settings.iaDesc': 'Kininaru is powered by Groq (gpt-oss-120b, hosted on Groq). Your messages are sent to the model only to generate answers — never sold or shared.',
  'settings.memory': 'Assistant memory',
  'settings.memoryDesc': 'Facts the assistant has remembered with your consent (goals, preferences, constraints) to personalize its answers. Strictly private: used only as context for your conversations, never shared. You can delete them at any time.',
  'settings.memoryEmpty': 'No memory saved yet. The assistant will offer to remember a durable fact when it can help — you are always free to confirm or decline.',
  'settings.memoryDelete': 'Delete this memory',
  'settings.deleteAccount': 'Delete account',
  'settings.deleteAccountDesc': 'You can delete your account and all your data at any time. This action is permanent and irreversible.',
  'settings.deleteAccountLink': 'Request account deletion',

  'auth.loginTitle': 'Welcome back',
  'auth.loginSubtitle': 'Sign in to continue to Kininaru',
  'auth.signIn': 'Sign in',
  'auth.signingIn': 'Signing in...',
  'auth.or': 'or',
  'auth.google': 'Continue with Google',
  'auth.redirecting': 'Redirecting...',
  'auth.noAccount': "Don't have an account? ",
  'auth.signUp': 'Sign up',
  'auth.forgotPassword': 'Forgot password?',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.createAccount': 'Create your account',
  'auth.createSubtitle': 'Start your journey with Kininaru',
  'auth.displayName': 'Display name',
  'auth.namePlaceholder': 'Your name',
  'auth.minChars': 'At least 6 characters',
  'auth.creating': 'Creating account...',
  'auth.haveAccount': 'Already have an account? ',
  'auth.signInLink': 'Sign in',
  'auth.forgotTitle': 'Forgot password?',
  'auth.forgotSubtitle': "Enter your email and we'll send you a reset link.",
  'auth.sendReset': 'Send reset link',
  'auth.sending': 'Sending...',
  'auth.backToLogin': 'Back to login',
  'auth.checkEmail': 'Check your email',
  'auth.resetSent':
    'If an account exists for {email}, a reset link has been sent. Check your inbox (and your spam folder).',
  'auth.resetTitle': 'Set a new password',
  'auth.resetSubtitle': 'Choose a new password for your account.',
  'auth.newPassword': 'New password',
  'auth.confirmPassword': 'Confirm password',
  'auth.updatePassword': 'Update password',
  'auth.updating': 'Updating...',
  'auth.passwordUpdated': 'Password updated',
  'auth.redirectingToLogin': 'Redirecting to login...',
  'auth.authError': 'Authentication error',
  'auth.authErrorDesc': 'An error occurred during authentication. Please try again.',
  'auth.signUpSuccessTitle': 'Check your email',
  'auth.signUpSuccessDesc':
    "We've sent you a confirmation email. Please click the link in the email to verify your account and complete your registration.",
  'auth.googleFailed': 'Google sign-in failed',
  'auth.configRequiredTitle': 'Setup required',
  'auth.configRequiredDesc':
    'Kininaru needs your Supabase credentials to work. Create a .env.local file at the project root with these variables:',
  'auth.configRequiredNote':
    'The values come from your Supabase project (Settings → API) and your Groq account. The full guide is in README.md.',
  'auth.configRequiredHome': 'Back to home',
  'auth.configRequiredCopy': 'Copy',
  'auth.configRequiredCopied': 'Copied!',
}

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { fr, en }

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const STORAGE_KEY = 'kininaru-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')

  // Restore the persisted choice (client-only — localStorage is unavailable
  // during SSR, so the default 'fr' renders first and flips on hydration).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'fr' || stored === 'en') {
        setLocaleState(stored)
      }
    } catch {
      // storage unavailable (private mode) — keep default
    }
  }, [])

  useEffect(() => {
    try {
      document.documentElement.lang = locale
    } catch {
      // no-op
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let value = dictionaries[locale][key] ?? key
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(val))
        }
      }
      return value
    },
    [locale]
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useI18n() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    // Fail loudly in development rather than silently rendering raw keys.
    throw new Error('useI18n must be used within a LocaleProvider')
  }
  return ctx
}
