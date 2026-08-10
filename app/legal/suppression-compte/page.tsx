import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Suppression du compte',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-serif font-bold text-foreground mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
      {children}
    </div>
  </section>
)

export default function SuppressionComptePage() {
  return (
    <article>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
        Suppression du compte
      </h1>
      <p className="text-xs text-muted-foreground mb-10">
        Dernière mise à jour : août 2026
      </p>

      <Section title="1. Comment demander la suppression">
        <p>
          L’application ne propose <strong>pas encore</strong> de bouton de suppression automatique
          du compte dans les réglages.
        </p>
        <p>
          Pour supprimer votre compte, envoyez une demande à l’Exploitant à l’adresse{' '}
          <strong>kininaru.planner@gmail.com</strong>, depuis
          l’adresse e-mail utilisée pour le compte concerné. La demande sera traitée par
          l’Exploitant dans un délai raisonnable.
        </p>
      </Section>

      <Section title="2. Ce qui est supprimé">
        <p>
          La suppression du compte entraîne la suppression de l’ensemble des données qui y sont
          liées :
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>le compte d’authentification (e-mail / mot de passe) ;</li>
          <li>le profil (nom d’affichage, XP, niveau) ;</li>
          <li>les tâches, événements du calendrier, habitudes et historiques de validation ;</li>
          <li>les entrées de journal et les sessions de concentration.</li>
        </ul>
        <p>
          Techniquement, les données liées à un compte sont supprimées en cascade avec celui-ci (les
          tables de la base sont configurées pour être effacées lors de la suppression du compte
          utilisateur).
        </p>
      </Section>

      <Section title="3. Données « Family »">
        <p>
          La fonctionnalité Family n’étant pas encore active, aucune donnée Family n’existe à
          supprimer. Lorsqu’elle sera disponible, les données partagées au sein d’un groupe seront
          traitées dans le cadre de la même procédure de suppression.
        </p>
      </Section>

      <Section title="4. Conservations éventuelles">
        <p>
          Certaines informations peuvent subsister temporairement après la demande de suppression :
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            des journaux techniques d’exploitation (notamment adresse IP) conservés pour une durée
            limitée à des fins de sécurité ;
          </li>
          <li>
            les copies de sauvegarde de la base de données, qui sont purgées selon le cycle de
            sauvegarde de l’hébergeur.
          </li>
        </ul>
        <p>
          L’Exploitant ne garantit pas de délai précis de suppression ; la suppression n’est pas
          instantanée.
        </p>
      </Section>

      <Section title="5. Conséquences">
        <p>
          La suppression est <strong>définitive et irréversible</strong> : vous perdrez l’accès au
          compte, aux contenus saisis et aux fonctionnalités associées. Les données supprimées ne
          sont pas récupérables.
        </p>
      </Section>
    </article>
  )
}
