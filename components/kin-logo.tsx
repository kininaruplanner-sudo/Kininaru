import { cn } from '@/lib/utils'

/**
 * Kininaru brand mark — a lotus flower, drawn as a wide open cup of
 * layered petals. Deliberately NOT a cactus: no dots, no tall vertical
 * spike; the silhouette is wider than it is tall, with petals that splay
 * outward and a gently rounded dome (growth → evolution → new day).
 *
 * The mark is filled with the brand gradient (brand → cool → warm, i.e.
 * cyan → marine → orange for the single Memphis palette) so it carries the
 * full identity of Kininaru. The wordmark keeps `currentColor` (navy by
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
      viewBox="0 0 64 80"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* K letter — sage green */}
      <path d="M12 8 L12 52 L18 52 L18 34 L30 52 L38 52 L26 32 L40 8 L33 8 L22 27 L18 23 L18 8 Z" fill="#8fb5a1" />
      {/* P letter — lavender/lilac */}
      <path d="M40 8 L40 52 L46 52 L46 32 L52 32 C 59 32 62 27 62 22 C 62 16 59 11 52 11 L46 11 L46 8 Z" fill="#b0a5d4" />
      {/* P inner cutout — white */}
      <rect x="46" y="17" width="8" height="12" rx="1.5" fill="#ffffff" />
      {/* Star accent — peach/coral */}
      <path d="M57 2 L58.5 5.5 L62 4 L59.5 7 L63 8 L59.5 8 L61 11.5 L58 9 L55 11 L57 7.5 L53.5 6.5 L57 5.5 Z" fill="#e0a89a" />
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
