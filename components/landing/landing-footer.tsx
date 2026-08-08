import Link from 'next/link'
import { LogoMark } from './logo-mark'

const FOOTER_LINKS = {
  Produit: [
    { label: 'Aperçu', href: '#apercu' },
    { label: 'Fonctionnalités', href: '#fonctionnalites' },
    { label: 'Avis', href: '#temoignages' },
    { label: 'FAQ', href: '#faq' },
  ],
  Compte: [
    { label: 'Se connecter', href: '/auth/login' },
    { label: 'Créer un compte', href: '/auth/sign-up' },
  ],
  Légal: [
    { label: 'Confidentialité', href: '/legal/confidentialite' },
    { label: 'Conditions d’utilisation', href: '/legal/conditions' },
    { label: 'Suppression de compte', href: '/legal/suppression-compte' },
  ],
}

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <LogoMark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Un espace calme et personnalisable pour organiser votre vie, une journée à la fois.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-smooth"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} Kininaru. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground">Conçu pour une vie plus posée.</p>
        </div>
      </div>
    </footer>
  )
}
