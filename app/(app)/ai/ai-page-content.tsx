'use client'

import { motion } from 'framer-motion'
import { CalendarDays, Sunrise, Target, TrendingUp, ListChecks, Moon } from 'lucide-react'
import { CoachMascot } from '@/components/coach-mascot'

interface AiPageContentProps {
  displayName: string
}

const QUICK_ACTIONS = [
  { icon: CalendarDays, text: 'Planifier ma journée', prompt: 'Planifier ma journée' },
  { icon: Target, text: 'Mes priorités', prompt: 'Mes priorités' },
  { icon: TrendingUp, text: 'Analyser ma semaine', prompt: 'Analyser ma semaine' },
  { icon: Sunrise, text: 'Créer une routine', prompt: 'Créer une routine' },
  { icon: ListChecks, text: 'Découper un objectif', prompt: 'Découper un objectif en étapes' },
  { icon: Moon, text: 'Préparer demain', prompt: 'Préparer demain' },
]

export function AiPageContent({ displayName }: AiPageContentProps) {
  const sendToAssistant = (prompt: string) => {
    window.dispatchEvent(
      new CustomEvent('kininaru:ai-send', { detail: { message: prompt } })
    )
  }

  return (
    <div className="h-full overflow-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto"
      >
        {/* Coach face */}
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-kin"
            style={{ background: 'linear-gradient(135deg, #8fb5a1 0%, #b0a5d4 50%, #e0a89a 100%)' }}
          >
            <CoachMascot mood="calm" className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="kin-h2 text-center text-foreground mb-2">
          <span className="kin-ai-gradient">Bonjour {displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
          Je suis votre coach de productivité. Posez-moi une question dans le panneau de droite
          ou choisissez un sujet ci-dessous.
        </p>

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Suggestions
          </p>
          {QUICK_ACTIONS.map((action, i) => (
            <motion.button
              key={action.text}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
              onClick={() => sendToAssistant(action.prompt)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/60 text-sm text-foreground hover:border-primary/40 hover:bg-primary/5 transition-smooth text-left group"
            >
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-smooth">
                <action.icon className="w-4 h-4 text-primary" />
              </span>
              {action.text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
