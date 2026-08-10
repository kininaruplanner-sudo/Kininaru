import { cn } from '@/lib/utils'

/**
 * Kininaru · BÊTA — petit badge discret, élégant, professionnel.
 * Affiché près du logo (sidebar, barre mobile, landing) et dans À propos.
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5',
        'text-[9px] font-bold uppercase tracking-[0.14em] text-primary select-none',
        className
      )}
      title="Kininaru est actuellement en version bêta"
    >
      <span className="w-1 h-1 rounded-full bg-primary/70" aria-hidden />
      Bêta
    </span>
  )
}
