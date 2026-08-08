import { LegalPageShell } from '@/components/legal/legal-page-shell'

export const metadata = {
  title: "Conditions d'utilisation — Kininaru",
}

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Conditions d'utilisation" lastUpdated="[À COMPLÉTER — date de publication]">
      <section className="p-4 rounded-xl bg-secondary text-secondary-foreground text-xs leading-relaxed">
        Ce texte est un modèle générique de conditions d'utilisation. Il n'a pas été rédigé par un juriste
        et ne constitue pas un conseil juridique. Faites-le relire avant sa mise en ligne réelle et
        remplacez les passages marqués <strong>[À COMPLÉTER]</strong>.
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptation des conditions</h2>
        <p>
          En créant un compte ou en utilisant Kininaru Planner (« l'Application »), vous acceptez les
          présentes conditions d'utilisation. Si vous n'êtes pas d'accord, n'utilisez pas l'Application.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">2. Description du service</h2>
        <p>
          Kininaru Planner est une application de planification personnelle proposant calendrier, gestion de
          tâches, suivi d'habitudes, journal, mode concentration et un assistant IA. L'Application est
          fournie « en l'état », sans garantie de disponibilité continue.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">3. Compte utilisateur</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Vous devez fournir des informations exactes lors de la création de votre compte.</li>
          <li>Vous êtes responsable de la confidentialité de vos identifiants de connexion.</li>
          <li>[À COMPLÉTER — âge minimum requis pour utiliser l'Application, ex. 16 ans.]</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">4. Contenu utilisateur</h2>
        <p>
          Vous conservez tous les droits sur le contenu que vous créez dans l'Application (tâches,
          événements, entrées de journal, etc.). Vous nous accordez uniquement le droit technique nécessaire
          pour stocker et afficher ce contenu afin de vous fournir le service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">5. Assistant IA</h2>
        <p>
          L'assistant IA repose sur un modèle de langage tiers et peut occasionnellement produire des
          réponses inexactes ou inappropriées. Il ne constitue pas un conseil médical, juridique ou
          financier. Utilisez votre jugement avant d'agir sur la base de ses réponses.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">6. Usage interdit</h2>
        <p>Vous vous engagez à ne pas :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Utiliser l'Application à des fins illégales ou frauduleuses.</li>
          <li>Tenter d'accéder aux comptes ou données d'autres utilisateurs.</li>
          <li>Perturber ou surcharger volontairement l'infrastructure de l'Application.</li>
          <li>Faire de l'ingénierie inverse ou extraire le code source de l'Application.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">7. Résiliation</h2>
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Zone de danger. Nous nous
          réservons le droit de suspendre ou résilier un compte en cas de violation de ces conditions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation de responsabilité</h2>
        <p>
          Dans la mesure permise par la loi applicable, l'Application est fournie sans garantie d'aucune
          sorte. [À COMPLÉTER — clause de limitation de responsabilité adaptée à votre juridiction.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">9. Droit applicable</h2>
        <p>[À COMPLÉTER — droit applicable et juridiction compétente.]</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">10. Contact</h2>
        <p>Pour toute question relative à ces conditions : [À COMPLÉTER — e-mail de contact].</p>
      </section>
    </LegalPageShell>
  )
}
