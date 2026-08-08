import { LegalPageShell } from '@/components/legal/legal-page-shell'

export const metadata = {
  title: 'Politique de confidentialité — Kininaru',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Politique de confidentialité" lastUpdated="[À COMPLÉTER — date de publication]">
      <section className="p-4 rounded-xl bg-secondary text-secondary-foreground text-xs leading-relaxed">
        Ce texte est un modèle générique destiné à démarrer votre politique de confidentialité. Il n'a pas
        été rédigé par un juriste et ne constitue pas un conseil juridique. Avant sa mise en ligne réelle,
        faites-le relire (idéalement par un professionnel du droit) et remplacez chaque passage marqué{' '}
        <strong>[À COMPLÉTER]</strong> par les informations exactes de votre société ou de votre statut
        d'éditeur individuel.
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">1. Qui sommes-nous</h2>
        <p>
          Kininaru Planner (« l'Application », « nous ») est édité par [À COMPLÉTER — nom légal de
          l'éditeur, forme juridique, adresse, e-mail de contact]. Pour toute question relative à vos
          données personnelles, contactez-nous à [À COMPLÉTER — e-mail de contact dédié, ex.
          privacy@votredomaine.com].
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">2. Données que nous collectons</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Données de compte :</strong> adresse e-mail, nom affiché, et, si vous utilisez la
            connexion Google, votre identifiant Google, votre nom et votre photo de profil tels que fournis
            par Google.
          </li>
          <li>
            <strong>Contenu que vous créez :</strong> tâches, événements de calendrier, habitudes, entrées
            de journal, sessions de concentration et messages échangés avec l'assistant IA.
          </li>
          <li>
            <strong>Préférences :</strong> thème choisi, préférences de notifications.
          </li>
          <li>
            <strong>Données techniques :</strong> cookies de session strictement nécessaires à
            l'authentification (gérés par Supabase Auth) et journaux techniques standard (adresse IP,
            type de navigateur) à des fins de sécurité et de débogage.
          </li>
        </ul>
        <p className="mt-2">
          Nous n'utilisons pas de cookies publicitaires ni de traceurs tiers à des fins marketing.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">3. Comment nous utilisons vos données</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fournir, maintenir et sécuriser votre compte et vos données au sein de l'Application.</li>
          <li>Faire fonctionner les fonctionnalités que vous utilisez (calendrier, tâches, habitudes, journal).</li>
          <li>
            Générer les réponses de l'assistant IA : le contenu de votre conversation est transmis à notre
            sous-traitant d'inférence IA (voir section 4) uniquement pour produire une réponse, et n'est pas
            utilisé par nous à d'autres fins.
          </li>
          <li>Vous contacter au sujet de votre compte (ex. réinitialisation de mot de passe).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">4. Sous-traitants et hébergement</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Supabase</strong> — hébergement de la base de données, authentification (y compris la
            connexion Google) et stockage de l'ensemble de vos données applicatives.
          </li>
          <li>
            <strong>Groq</strong> — fournisseur d'inférence utilisé pour générer les réponses de
            l'assistant IA ; seul le contenu de la conversation en cours lui est transmis.
          </li>
          <li>
            <strong>Google</strong> — si vous choisissez de vous connecter avec Google, Google traite les
            informations nécessaires à l'authentification conformément à sa propre politique de
            confidentialité.
          </li>
          <li>[À COMPLÉTER — ajoutez ici votre hébergeur front-end (ex. Vercel) et tout autre sous-traitant.]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">5. Durée de conservation</h2>
        <p>
          Vos données sont conservées tant que votre compte est actif. Vous pouvez supprimer votre compte et
          l'ensemble des données associées à tout moment depuis Paramètres → Zone de danger, ou via notre{' '}
          <a href="/legal/suppression-compte" className="text-primary hover:underline">
            page de suppression de compte
          </a>
          . La suppression est immédiate et définitive.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">6. Vos droits</h2>
        <p>
          Selon votre lieu de résidence (par exemple si le RGPD s'applique à vous), vous disposez d'un droit
          d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
          données. Vous pouvez exercer ces droits directement dans l'Application (Paramètres) ou en nous
          contactant à [À COMPLÉTER — e-mail de contact]. Vous disposez également du droit d'introduire une
          réclamation auprès de l'autorité de protection des données compétente.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">7. Sécurité</h2>
        <p>
          Vos données sont protégées par des règles d'accès strictes au niveau de la base de données (Row
          Level Security) : chaque utilisateur ne peut accéder qu'à ses propres données. Les mots de passe
          sont gérés et chiffrés par Supabase Auth ; nous n'y avons jamais accès en clair.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">8. Modifications de cette politique</h2>
        <p>
          Nous pouvons mettre à jour cette politique de confidentialité. En cas de changement important,
          nous vous en informerons via l'Application ou par e-mail.
        </p>
      </section>
    </LegalPageShell>
  )
}
