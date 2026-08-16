'use client'

import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bouton flottant Kininaru — ouvre l'assistant conversationnel.
 *
 * L'assistant n'est plus une destination de navigation : la bulle est le
 * point d'entrée principal. Un clic ouvre le panneau de chat à droite
 * (components/assistant-panel.tsx) qui réutilise le vrai système IA
 * (/api/chat, streaming Groq, conversations, mémoire, actions).
 *
 * Position : bottom-right, au-dessus de la barre d'onglets mobile ; relevé
 * sur /ai pour ne jamais couvrir le composer de la page (repli).
 */
export function CoachBubble() {
  const pathname = usePathname()
  const isAi = pathname === '/ai'

  return (
    <button
      onClick={() => window.dispatchEvent(new Event('kininaru:open-assistant'))}
      aria-label="Ouvrir l'assistant Kininaru"
      title="Assistant Kininaru"
      className={cn(
        'fixed z-40 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-kin-hover transition-smooth hover:scale-105 active:scale-95',
        'w-14 h-14',
        isAi ? 'bottom-32 right-4 md:bottom-32 md:right-6' : 'bottom-24 right-4 md:bottom-6 md:right-6'
      )}
    >
      <Sparkles className="w-6 h-6" />
    </button>
  )
}
