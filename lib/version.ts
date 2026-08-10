import pkg from '../package.json'

/**
 * Kininaru — version de l'application.
 *
 * Source unique de vérité : la version lue directement dans package.json
 * (aucun système de version contradictoire). Affichée dans
 * Paramètres → À propos et envoyée avec chaque retour utilisateur.
 */

export const APP_VERSION: string = pkg.version

/** Libellé complet affiché à l'utilisateur, ex. « Bêta 0.1.0 ». */
export const APP_VERSION_LABEL: string = `Bêta ${APP_VERSION}`

/** Kininaru est en phase bêta : badge et message de bienvenue s'appuient dessus. */
export const IS_BETA: boolean = true
