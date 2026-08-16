import { cn } from '@/lib/utils'

/**
 * Kininaru brand mark — a lotus flower, drawn as a wide open cup of
 * layered petals. Deliberately NOT a cactus: no dots, no tall vertical
 * spike; the silhouette is wider than it is tall, with petals that splay
 * outward and a gently rounded dome (growth → evolution → new day).
 *
 * The mark is filled with the brand gradient (brand → cool → warm, i.e.
 * cyan → marine → orange for the Kininaru palette) so it carries the full
 * identity of the active theme. The wordmark keeps `currentColor` (navy by
 * default) — surfaces can override it via the `color` prop.
 *
 * ⚠️ The petal paths live in THREE places that must stay in sync:
 *   1. here (React component)
 *   2. `public/icon.svg` (the visual source for generated PNG icons)
 *   3. `scripts/generate-icons.mjs` parses `public/icon.svg` — never hand-edit
 *      the PNGs in `public/`, re-run `npm run icons` instead.
 */

export function KinLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="url(#kin-logo-grad)"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="kin-logo-grad" x1="0%" y1="20%" x2="100%" y2="90%">
          <stop offset="0%" style={{ stopColor: 'var(--kt-brand)' }} />
          <stop offset="52%" style={{ stopColor: 'var(--kt-cool)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--kt-warm)' }} />
        </linearGradient>
      </defs>
      {/* Center petal — short, wide, rounded (the lotus cup, never a spike) */}
      <path d="M32 25 C 36.8 32 36.8 44 32 50 C 27.2 44 27.2 32 32 25 Z" />
      {/* Inner petals — sweep outward and up */}
      <path d="M30.5 47 C 24.5 44.5 18.5 38.5 18 28.5 C 23 30.5 28 39.5 30.5 47 Z" />
      <path d="M33.5 47 C 39.5 44.5 45.5 38.5 46 28.5 C 41 30.5 36 39.5 33.5 47 Z" />
      {/* Outer petals — the wide open bowl */}
      <path d="M30 51.5 C 21.5 51 13 48 10 41 C 17 43.5 24.5 47.5 30 51.5 Z" />
      <path d="M34 51.5 C 42.5 51 51 48 54 41 C 47 43.5 39.5 47.5 34 51.5 Z" />
      {/* Base petals — close the flower */}
      <path d="M31.5 53.5 C 27.5 55.5 24.5 55.5 22.5 54 C 25.5 56 28.5 56 31.5 53.5 Z" />
      <path d="M32.5 53.5 C 36.5 55.5 39.5 55.5 41.5 54 C 38.5 56 35.5 56 32.5 53.5 Z" />
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
