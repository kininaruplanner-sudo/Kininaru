import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ElementType
  actions?: ReactNode
  className?: string
}

/**
 * Single source of truth for feature-page headers. Every main page uses the
 * same pattern: optional icon chip, serif title, muted subtitle, actions on
 * the right — with identical spacing, radius and border.
 */
export function PageHeader({ title, subtitle, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-border bg-card/60 backdrop-blur-sm shrink-0',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="kin-h2 text-foreground">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
