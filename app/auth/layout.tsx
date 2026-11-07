/**
 * Les pages d'authentification n'avaient aucune région `main` : les lecteurs
 * d'écran ne trouvaient pas de repère principal et tout le contenu (titre,
 * formulaire, liens) était signalé comme hors landmark. Ce layout ajoute le
 * landmark une seule fois pour les six pages du parcours de connexion.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main>{children}</main>
}
