/**
 * Shared tag/category color palette used by color pickers (habits, events,
 * tasks). Values reference the `--kt-*` custom properties defined in
 * globals.css so every picker draws from one source of truth instead of
 * re-typing the same hex values per page.
 */
export const TAG_PALETTE = [
  { name: 'rose', value: 'var(--kt-rose)' },
  { name: 'rose-dark', value: 'var(--kt-rose-dark)' },
  { name: 'lavender', value: 'var(--kt-lavender)' },
  { name: 'violet', value: 'var(--kt-violet)' },
  { name: 'blue', value: 'var(--kt-blue)' },
  { name: 'sage', value: 'var(--kt-sage)' },
  { name: 'yellow', value: 'var(--kt-yellow)' },
  { name: 'coral', value: 'var(--kt-coral)' },
] as const

export const PALETTE_VALUES = TAG_PALETTE.map((c) => c.value)

export const palette = (name: (typeof TAG_PALETTE)[number]['name']) =>
  TAG_PALETTE.find((c) => c.name === name)!.value
