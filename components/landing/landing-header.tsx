'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LogoMark } from './logo-mark'

const NAV_LINKS = [
  { href: '#apercu', label: 'Aperçu' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#temoignages', label: 'Avis' },
  { href: '#faq', label: 'FAQ' },
]

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 glass-topbar">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Kininaru — accueil">
          <LogoMark />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="ghost" size="lg">
              Se connecter
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="lg">Commencer</Button>
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-smooth"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden overflow-hidden border-t border-border bg-background"
          >
            <div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-smooth"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-border">
                <Link href="/auth/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="secondary" size="lg" className="w-full">
                    Se connecter
                  </Button>
                </Link>
                <Link href="/auth/sign-up" onClick={() => setMobileOpen(false)}>
                  <Button size="lg" className="w-full">
                    Commencer
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
