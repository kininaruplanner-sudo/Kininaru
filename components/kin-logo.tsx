import { cn } from '@/lib/utils'

/**
 * Kininaru brand mark — the new logo: three dots above a stylized lotus
 * flower (multiple curved petal layers), in the brand dusty blue #5B8296.
 * One source of truth so the brand never drifts across surfaces.
 *
 * - `KinLogoMark`  : the mark alone (favicon, bubble, collapsed sidebar).
 * - `KinLogo`      : full lockup — mark + lowercase "kininaru" wordmark.
 *   * variant "stack" (default): wordmark BELOW the lotus (the brand lockup)
 *   * variant "row"            : wordmark beside the lotus (navbars, sidebar)
 *
 * The mark uses `currentColor` — surfaces can override the color by passing
 * a `color` prop or a text-color class on the wrapper.
 */

export function KinLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="currentColor"
      className={cn('shrink-0', className)}
    >
      {/* Three dots — center raised */}
      <rect x="24.5" y="9" width="4.5" height="4.5" rx="1.1" />
      <rect x="29.75" y="5" width="4.5" height="4.5" rx="1.1" />
      <rect x="35" y="9" width="4.5" height="4.5" rx="1.1" />
      {/* Lotus — center petal */}
      <path d="M32 54 C 28 44 27 30 32 20 C 37 30 36 44 32 54 Z" />
      {/* Inner petals */}
      <path d="M32 52 C 26 46 21 36 20 28 C 25 32 29 41 32 52 Z" />
      <path d="M32 52 C 38 46 43 36 44 28 C 39 32 35 41 32 52 Z" />
      {/* Outer petals */}
      <path d="M32 55 C 24 50 15 44 12 38 C 19 42 26 48 32 55 Z" />
      <path d="M32 55 C 40 50 49 44 52 38 C 45 42 38 48 32 55 Z" />
      {/* Base petals */}
      <path d="M32 57 C 25 58 18 57 15 53 C 20 58 26 59 32 57 Z" />
      <path d="M32 57 C 39 58 46 57 49 53 C 44 58 38 59 32 57 Z" />
    </svg>
  )
}

export function KinLogo({
  className,
  showWordmark = true,
  wordmarkClassName,
  markClassName,
  color = '#5B8296',
  variant = 'stack',
}: {
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
  markClassName?: string
  /** Brand dusty blue by default; surfaces can pass any color. */
  color?: string
  /** stack = wordmark below the lotus (brand lockup), row = beside it. */
  variant?: 'stack' | 'row'
}) {
  return (
    <span
      className={cn(
        'inline-flex select-none',
        variant === 'stack'
          ? 'flex-col items-center gap-1.5 text-center'
          : 'items-center gap-2.5',
        className
      )}
      style={{ color }}
    >
      <KinLogoMark
        className={cn(
          variant === 'stack' ? 'w-10 h-10' : 'w-8 h-8',
          markClassName
        )}
      />
      {showWordmark && (
        <span
          className={cn(
            '[font-family:var(--font-jakarta),ui-sans-serif,system-ui,sans-serif] font-semibold lowercase tracking-tight leading-none',
            variant === 'stack' ? 'text-xl' : 'text-lg',
            wordmarkClassName
          )}
        >
          kininaru
        </span>
      )}
    </span>
  )
}
