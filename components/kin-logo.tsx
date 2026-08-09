import { cn } from '@/lib/utils'

/**
 * Single Kininaru mark used everywhere (landing, auth, app shell):
 * a primary rounded tile with a white 4-point sparkle + serif wordmark.
 * One source of truth so the brand never drifts across surfaces.
 */
export function KinLogo({
  className,
  showWordmark = true,
  wordmarkClassName,
}: {
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative w-8 h-8 rounded-xl bg-primary shadow-kin flex items-center justify-center shrink-0">
        <span className="absolute inset-0 rounded-xl bg-white/10 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="w-4.5 h-4.5 text-white relative"
        >
          <path
            d="M12 2.5c.55 4.65 2 6.55 8.5 7.5-6.5.95-7.95 2.85-8.5 7.5-.55-4.65-2-6.55-8.5-7.5C10 9.05 11.45 7.15 12 2.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn('font-serif font-bold text-lg tracking-tight text-foreground', wordmarkClassName)}>
          Kininaru
        </span>
      )}
    </span>
  )
}
