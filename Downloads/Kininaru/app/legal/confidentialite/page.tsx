import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-serif font-bold text-foreground mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
      {children}
    </div>
  </section>
)

export default function ConfidentialitePage() {
  return (
    <article>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
        Politique de confidentialité
      </h1>
      <p className="text-xs text-muted-foreground mb-10">
        Dernière mise à jour : août 2026
      </p>

      <Section title="1. Responsable du traitement">
        <p>
          La présente politique décrit la manière dont Kininaru traite les données à caractère
          personnel des utilisateurs. L’Exploitant est{' '}
          <strong>[identité et coordonnées à renseigner avant la mise en ligne]</strong>.
        </p>
      </Section>

      <Section title="2. Données réellement traitées">
        <p>
          Kininaru traite uniquement les données nécessaires au fonctionnement décrit ci-dessous.
          Aucune autre donnée n’est collectée.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Données de compte :</strong> adresse e-mail et mot de passe (stocké sous forme
            hachée par le fournisseur d’authentification Supabase Auth).
          </li>
          <li>
            <strong>Données de profil :</strong> nom d’affichage, points d’expérience (XP) et
            niveau, utilisés pour la gamification.
          </li>
          <li>
            <strong>Contenus créés par l’utilisateur :</strong> tâches (titre, description,
            priorité, statut, date d’échéance, étiquettes), événements du calendrier, habitudes et
            leurs historiques de validation, entrées de journal (humeur, texte, gratitude,
            objectifs), sessions de concentration (durée) et statistiques qui en découlent.
          </li>
          <li>
            <strong>Données « Family » :</strong> la fonctionnalité Family n’est pas encore active ;
            aucune donnée de famille n’est stockée à ce jour.
          </li>
          <li>
            <strong>Messages envoyés à l’assistant IA :</strong> transmis au fournisseur IA pour
            générer une réponse (voir section 5). Ils ne sont pas conservés dans la base de données
            de Kininaru.
          </li>
          <li>
            <strong>Données techniques :</strong> horodatages de création des contenus, cookies de
            session d’authentification, et journaux techniques d’exploitation (notamment adresse IP)
            susceptibles d’être enregistrés par l’hébergeur à des fins de fonctionnement et de
            sécurité.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalités">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>fournir et faire fonctionner le service (enregistrement des données saisies) ;</li>
          <li>authentifier les utilisateurs et protéger l’accès à leur compte ;</li>
          <li>assurer la sécurité du service ;</li>
          <li>fournir l’assistant IA conversationnel ;</li>
          <li>améliorer le service sur la base d’informations agrégées.</li>
        </ul>
      </Section>

      <Section title="4. Stockage et hébergement">
        <p>
          Les données sont stockées dans une base de données hébergée par un prestataire tiers
          (Supabase). Chaque utilisateur n’accède qu’aux données de son propre compte : la base est
          protégée par des contrôles d’accès au niveau des lignes (Row Level Security) qui
          restreignent chaque requête au compte authentifié.
        </p>
        <p>
          Ces mesures réduisent significativement les risques d’accès non autorisés, mais ne
          constituent pas une garantie absolue de sécurité, comme c’est le cas pour tout service
          en ligne.
        </p>
      </Section>

      <Section title="5. Assistant IA (prestataire tiers — Groq)">
        <p>
          Lorsque vous utilisez l’assistant IA, Kininaru transmet au fournisseur IA (Groq) les
          messages de la conversation en cours, y compris l’historique affiché dans la fenêtre, afin
          qu’une réponse puisse être générée.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Ces conversations ne sont pas enregistrées dans la base de données de Kininaru.</li>
          <li>
            Kininaru n’a pas de contrôle sur les pratiques de conservation ou d’utilisation de ces
            données par Groq ; pour les connaître, consultez la politique de confidentialité de Groq.
          </li>
          <li>
            Ne saisissez pas de données sensibles dans les conversations (identifiants, données
            médicales, financières, ou données de tiers).
          </li>
        </ul>
      </Section>

      <Section title="6. Authentification">
        <p>
          La connexion s’effectue avec une adresse e-mail et un mot de passe, gérés par le service
          Supabase Auth. Les mots de passe ne sont pas stockés en clair par Kininaru. La connexion
          via un compte tiers (par exemple Google) n’est pas proposée actuellement ; aucune donnée
          de compte Google n’est donc collectée.
        </p>
      </Section>

      <Section title="7. Cookies et session">
        <p>
          Kininaru utilise des cookies de session strictement nécessaires au maintien de votre
          authentification. Le service n’utilise pas de publicité ni de suivi publicitaire.
        </p>
      </Section>

      <Section title="8. Durée de conservation">
        <p>
          Les données sont conservées tant que votre compte est actif, puis supprimées lorsque vous
          demandez la suppression de votre compte (voir la page « Suppression du compte »). Des
          journaux techniques peuvent être conservés pendant une durée limitée à des fins de
          sécurité.
        </p>
      </Section>

      <Section title="9. Vos droits">
        <p>
          Vous disposez de droits sur vos données personnelles : accès, rectification, effacement,
          limitation du traitement, opposition et portabilité, dans les conditions prévues par la
          réglementation applicable (notamment le RGPD pour les résidents de l’Union européenne).
        </p>
        <p>
          Pour exercer ces droits, contactez l’Exploitant à l’adresse{' '}
          <strong>[adresse e-mail de contact à renseigner avant la mise en ligne]</strong> en
          précisant l’adresse e-mail de votre compte. Vous pouvez également déposer une réclamation
          auprès de l’autorité de protection des données compétente (en France, la CNIL).
        </p>
      </Section>

      <Section title="10. Évolutions de la politique">
        <p>
          Cette politique peut être mise à jour, notamment pour refléter l’évolution du service. La
          date de dernière mise à jour figure en haut de la page.
        </p>
      </Section>
    </article>
  )
}
