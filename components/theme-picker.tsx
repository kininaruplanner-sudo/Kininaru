'use client'

import { Check } from 'lucide-react'
import { useTheme, THEMES } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

/**
 * Sélecteur de thèmes visuel — chaque carte montre un aperçu miniature de
 * l'interface (barre, lignes, pastilles de la palette, bouton) construit
 * sur les 4 couleurs du thème. Changement instantané, persisté dans
 * localStorage (theme-provider).
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {THEMES.map((t) => {
        const active = theme === t.value
        const [c1, c2, c3, c4] = t.colors
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            aria-pressed={active}
            title={t.name}
            className={cn(
              'group rounded-2xl border-2 p-2 text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary bg-primary/5 shadow-kin' : 'border-border hover:border-primary/50 hover:bg-muted/40'
            )}
          >
            {/* Miniature d'interface */}
            <div
              className="rounded-xl border border-black/5 overflow-hidden"
              style={{ background: t.bg }}
            >
              <div className="h-4 flex items-center gap-1 px-1.5" style={{ background: c1 }}>
                <span className="w-3 h-1 rounded-full bg-white/70" />
                <span className="w-2 h-1 rounded-full bg-white/40" />
                <span className="ml-auto w-2.5 h-1 rounded-full bg-white/50" />
              </div>
              <div className="p-2 space-y-1.5">
                <div className="h-1.5 w-3/4 rounded-full" style={{ background: c1, opacity: 0.35 }} />
                <div className="h-1.5 w-1/2 rounded-full" style={{ background: c1, opacity: 0.22 }} />
                <div className="flex gap-1 pt-0.5">
                  {[c1, c2, c3, c4].map((c) => (
                    <span
                      key={c}
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-black/5"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="h-3 w-10 rounded-md" style={{ background: c1 }} />
                  <span className="h-3 w-6 rounded-md" style={{ background: c3, opacity: 0.75 }} />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
              <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
              {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={3} />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
