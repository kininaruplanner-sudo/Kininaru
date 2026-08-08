'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

const FAQS = [
  {
    question: 'Est-ce que Kininaru est gratuit ?',
    answer:
      'Oui, la création de compte et l’accès à l’ensemble des modules sont gratuits. Vous pouvez commencer à organiser votre vie dès aujourd’hui, sans carte bancaire.',
  },
  {
    question: 'Mes données sont-elles privées ?',
    answer:
      'Vos tâches, événements, habitudes et notes de journal sont liés à votre compte et ne sont visibles que par vous, sauf si vous choisissez explicitement de les partager (par exemple via l’espace Famille).',
  },
  {
    question: 'Puis-je changer l’apparence de l’application ?',
    answer:
      'Oui — six ambiances visuelles sont disponibles, dont un mode sombre. Vous pouvez essayer chaque thème directement depuis cette page, dans la section d’aperçu.',
  },
  {
    question: 'Kininaru fonctionne-t-il sur mobile ?',
    answer:
      'L’interface s’adapte à toutes les tailles d’écran, du téléphone à l’écran large, sans installation nécessaire : il suffit d’ouvrir votre navigateur.',
  },
  {
    question: 'Comment fonctionne l’assistant IA ?',
    answer:
      'L’assistant s’appuie sur le contexte de votre planning (tâches, habitudes, événements) pour vous proposer des réponses et des suggestions pertinentes, directement depuis le module Assistant IA.',
  },
  {
    question: 'Puis-je supprimer mon compte et mes données ?',
    answer:
      'Oui, à tout moment depuis les Réglages. La suppression est définitive et retire l’ensemble de vos informations de nos serveurs.',
  },
]

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Questions fréquentes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tout ce qu’il faut savoir avant de commencer.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div key={faq.question} className={cn(cardVariants({ padding: 'md' }), 'p-0')}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-foreground sm:text-base">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-250',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
