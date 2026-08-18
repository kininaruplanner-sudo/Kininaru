import { cn } from '@/lib/utils'

/**
 * Kininaru brand mark — interlocking K + P monogram.
 *
 * K: sage green with vertical bar + two diagonal strokes
 * P: lavender/lilac with rounded bowl, overlapping the K
 * Star: peach/coral 4-pointed sparkle accent
 *
 * ⚠️ The mark paths live in TWO places that must stay in sync:
 *   1. here (React component)
 *   2. `public/icon.svg` (the visual source for generated PNG icons)
 */

export function KinLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 170"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* K letter — sage green, modern geometric with curved diagonal strokes */}
      <path
        d="M25 10 L25 145 L43 145 L43 75 L85 145 L105 145 L63 72 L115 10 L93 10 L48 66 L43 62 L43 10 Z"
        fill="#8FB5A1"
      />
      {/* P letter — lavender/lilac, overlapping K with rounded bowl */}
      <path
        d="M100 10 L100 145 L118 145 L118 82 C118 52 130 34 155 34 C170 34 178 42 178 55 C178 68 170 78 155 78 L118 78 L118 10 Z"
        fill="#B0A5D4"
      />
      {/* P inner cutout — white negative space */}
      <rect x="133" y="45" width="27" height="22" rx="6" fill="#FFFFFF" />
      {/* Star / sparkle accent — peach/coral, 4-pointed */}
      <path
        d="M168 8 L171.5 18 L182 14 L174 22 L184 24 L174 24 L178 34 L171.5 26 L164 30 L169 22 L158 20 L169 18 Z"
        fill="#E0A89A"
      />
    </svg>
  )
}

export function KinLogo({
  className,
  showWordmark = true,
  wordmarkClassName,
  markClassName,
  color = '#1A365D',
  variant = 'stack',
}: {
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
  markClassName?: string
  /** Brand marine (navy) by default; surfaces can pass any color. */
  color?: string
  /** stack = wordmark below the monogram (brand lockup), row = beside it. */
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
        <span className={cn('flex flex-col', variant === 'stack' ? 'items-center' : 'items-start', wordmarkClassName)}>
          <span
            className={cn(
              '[font-family:var(--font-jakarta),ui-sans-serif,system-ui,sans-serif] font-semibold uppercase tracking-[0.18em] leading-none',
              variant === 'stack' ? 'text-lg' : 'text-sm'
            )}
          >
            kininaru
          </span>
          <span className="text-[0.55em] tracking-[0.25em] text-muted-foreground/70 mt-0.5">PLAN · FOCUS · GROW</span>
        </span>
      )}
    </span>
  )
}
