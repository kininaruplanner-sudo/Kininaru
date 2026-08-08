'use client'

import { useState, useRef, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEMES, useTheme } from '@/components/theme-provider'
import { cardVariants } from '@/components/ui/card'

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Changer de thème"
        aria-label="Changer de thème"
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth',
          collapsed && 'lg:justify-center lg:px-2'
        )}
      >
        <Palette className="w-4 h-4 shrink-0" />
        <span className={cn(collapsed && 'lg:hidden')}>Thème</span>
      </button>

      {open && (
        <div
          className={cn(
            cardVariants({ padding: 'sm' }),
            'absolute bottom-full mb-2 shadow-kin-hover p-2 z-20 left-0 w-full',
            collapsed && 'lg:left-full lg:ml-2 lg:w-44'
          )}
        >
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-smooth hover:bg-muted',
                theme === t.value ? 'bg-primary/15 text-foreground' : 'text-muted-foreground'
              )}
            >
              <span className="flex gap-0.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
