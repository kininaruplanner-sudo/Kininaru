import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-serif font-bold text-foreground mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
      {children}
    </div>
  </section>
)

export default function ConditionsPage() {
  return (
    <article>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
        Conditions d’utilisation
      </h1>
      <p className="text-xs text-muted-foreground mb-10">
        Dernière mise à jour : août 2026
      </p>

      <Section title="1. Le service">
        <p>
          Kininaru est un planificateur personnel de productivité accessible en ligne. Il permet
          notamment de gérer un tableau de bord, un calendrier, des tâches, des habitudes, des
          sessions de concentration (Focus), un journal, des statistiques et des succès, et de
          discuter avec un assistant IA conversationnel.
        </p>
        <p>
          Le service est fourni par un exploitant privé (l’« Exploitant »). L’identité de
          l’Exploitant est <strong>kininaru.planner@gmail.com</strong>.
        </p>
      </Section>

      <Section title="2. Acceptation des conditions">
        <p>
          En créant un compte ou en utilisant Kininaru, vous acceptez les présentes conditions.
          Si vous ne les acceptez pas, veuillez ne pas utiliser le service.
        </p>
      </Section>

      <Section title="3. Compte utilisateur">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            La création d’un compte nécessite une adresse e-mail et un mot de passe. L’inscription
            est traitée par un fournisseur d’authentification tiers (Supabase) ; Kininaru ne stocke
            pas votre mot de passe en clair.
          </li>
          <li>
            Vous êtes responsable de la confidentialité de vos identifiants. Si vous pensez qu’un
            tiers y a accès, changez votre mot de passe et contactez l’Exploitant.
          </li>
          <li>
            Chaque compte est destiné à un usage personnel. Le partage d’un compte entre plusieurs
            personnes n’est pas prévu.
          </li>
        </ul>
      </Section>

      <Section title="4. Règles générales d’utilisation">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Vous ne devez pas tenter d’accéder aux comptes ou aux données d’autres utilisateurs.</li>
          <li>Vous ne devez pas perturber le fonctionnement du service ni en abuser (notamment par des requêtes automatisées excessives).</li>
          <li>Vous restez responsable du contenu que vous saisissez dans l’application.</li>
          <li>Vous ne devez pas utiliser le service à des fins illicites.</li>
        </ul>
      </Section>

      <Section title="5. Utilisation responsable de l’assistant IA">
        <p>
          Kininaru propose un assistant IA conversationnel (fourni par un prestataire tiers, Groq)
          destiné à vous aider dans votre organisation et votre motivation.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Ne saisissez pas de données sensibles</strong> dans les conversations : identifiants,
            mots de passe, données médicales, financières ou bancaires, ni de données personnelles
            concernant des tiers.
          </li>
          <li>
            Les messages que vous envoyez sont transmis au fournisseur IA afin de générer une réponse
            (voir la politique de confidentialité).
          </li>
          <li>
            L’assistant n’est pas un professionnel : ses réponses ne constituent ni un conseil médical,
            juridique, financier ni aucune autre forme de conseil professionnel.
          </li>
        </ul>
      </Section>

      <Section title="6. Limites de l’IA">
        <p>
          L’assistant IA génère des réponses automatiquement. Il peut se tromper, mal interpréter une
          demande ou produire un contenu inapproprié. Vérifiez toute information importante avant de
          la suivre. L’Exploitant ne garantit pas l’exactitude, la pertinence ni l’exhaustivité des
          réponses de l’IA.
        </p>
      </Section>

      <Section title="7. Fonctionnalité Family">
        <p>
          La fonctionnalité « Family » (partage de calendrier et de tâches au sein d’un foyer) est
          en cours de développement et n’est pas encore disponible. Lorsqu’elle sera active, elle
          impliquera le partage de certaines données entre les membres d’un même groupe ; les
          membres d’un groupe pourront voir les informations partagées dans ce groupe.
        </p>
      </Section>

      <Section title="8. Âge minimum">
        <p>
          Le service n’effectue <strong>aucune vérification automatisée de l’âge</strong> à
          l’inscription. Kininaru est destiné aux personnes d’au moins 15 ans, ou à l’âge de la
          majorité numérique en vigueur dans leur pays de résidence si celui-ci est plus élevé.
          En deçà de cet âge, l’utilisation nécessite l’autorisation d’un parent ou d’un tuteur,
          qui est réputée donnée lors de la création du compte.
        </p>
      </Section>

      <Section title="9. Suspension et suppression de compte">
        <p>
          En cas de violation manifeste des présentes conditions, l’Exploitant peut suspendre ou
          supprimer un compte, après information de l’utilisateur lorsque cela est possible.
        </p>
        <p>
          Vous pouvez demander la suppression de votre compte et des données associées à tout moment :
          voir la page <a href="/legal/suppression-compte" className="text-primary underline">Suppression du compte</a>.
        </p>
      </Section>

      <Section title="10. Évolutions du service">
        <p>
          Le service peut évoluer : nouvelles fonctionnalités, modifications, ou interruption
          temporaire ou définitive de tout ou partie du service, avec un préavis raisonnable
          lorsque cela est possible.
        </p>
      </Section>

      <Section title="11. Limites de responsabilité">
        <p>
          Le service est fourni « en l’état ». L’Exploitant s’efforce d’assurer un fonctionnement
          correct, mais ne garantit pas l’absence d’interruption, d’erreur ou de perte de données.
        </p>
        <p>
          Dans la mesure permise par la loi applicable, la responsabilité de l’Exploitant est
          limitée aux dommages directs et prévisibles résultant d’une faute de sa part. Ces limites
          ne s’appliquent pas en cas de faute intentionnelle ou de manquement à une obligation
          légale impérative.
        </p>
      </Section>

      <Section title="12. Données personnelles">
        <p>
          Le traitement de vos données est décrit dans la{' '}
          <a href="/legal/confidentialite" className="text-primary underline">
            politique de confidentialité
          </a>
          .
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Pour toute question relative aux présentes conditions :{' '}
          <strong>kininaru.planner@gmail.com</strong>.
        </p>
      </Section>
    </article>
  )
}
