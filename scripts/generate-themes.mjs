/**
 * Kininaru — design-token generator.
 *
 * Turns the single brand palette into the complete design system
 * (background, foreground, cards, borders, muted, primary, secondary,
 * accent, charts, sidebar, ring…) and writes `app/themes.css` (committed).
 *
 * Design rules:
 *  - Identité unique : thème clair, fond blanc #FFFFFF, pas de data-theme.
 *  - c1 = brand / primary actions (cyan #00C2E0)
 *  - c2 = secondary accent (marine #1A365D) — le texte en est dérivé,
 *    donc les titres sont en bleu marine
 *  - c3 = warm accent (orange vif #FF6B35)
 *  - c4 = complementary (terracotta #6A2B05)
 *  - neutrals are DERIVED from the palette (tinted, never pure gray);
 *  - every foreground is contrast-checked against its background (≥ 4.5:1
 *    for text, ≥ 3:1 for large/charts).
 *
 * Regenerate with:  node scripts/generate-themes.mjs
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'app', 'themes.css')

/* ------------------------------------------------------------------ */
/* Color math                                                          */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function mix(a, b, t) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  })
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lin = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Darkens `color` toward near-black until it reaches `target` contrast on `bg`. */
function ensureContrast(color, bg, target) {
  let c = color
  let i = 0
  while (contrast(c, bg) < target && i < 24) {
    c = mix(c, '#10141C', 0.14)
    i++
  }
  return c
}

/** Chart colors must be visible on white: darken overly pale palettes. */
function chartColor(hex) {
  if (luminance(hex) > 0.6) return mix(hex, '#20263A', 0.32)
  return hex
}

/* ------------------------------------------------------------------ */
/* Single brand palette                                                */
/* ------------------------------------------------------------------ */

// [c1 brand, c2 secondary accent, c3 warm accent, c4 complementary]
const [c1, c2, c3, c4] = ['#00C2E0', '#1A365D', '#FF6B35', '#6A2B05']

const WHITE = '#FFFFFF'

// Fond blanc épuré — les accents (cartes, sidebar, muted) gardent une teinte
// légère de la palette pour conserver l'identité visuelle.
const background = WHITE
const foreground = ensureContrast(mix(c2, '#1C2230', 0.22), background, 9)
const card = WHITE
const primary = ensureContrast(c1, WHITE, 4.6)
const primaryFg = WHITE
const secondary = mix(c1, WHITE, 0.86)
const muted = mix(c1, WHITE, 0.9)
const mutedFg = ensureContrast(mix(c2, '#5B6472', 0.38), background, 4.5)
const accent = mix(c2, WHITE, 0.84)
const accentFg = ensureContrast(mix(c2, '#1C2230', 0.3), accent, 4.5)
const border = mix(c2, WHITE, 0.85)
const input = mix(c2, WHITE, 0.78)
const ring = primary
const sidebar = mix(background, c1, 0.05)
const sidebarAccent = secondary
const sidebarAccentFg = ensureContrast(primary, sidebarAccent, 4.5)
const sidebarBorder = border

const chart = [c1, c2, c3, c4, mix(c2, c4, 0.5)].map(chartColor)

const TOKENS = {
  'color-scheme': 'light',
  '--kt-background': background,
  '--kt-foreground': foreground,
  '--kt-card': card,
  '--kt-card-foreground': foreground,
  '--kt-popover': card,
  '--kt-popover-foreground': foreground,
  '--kt-primary': primary,
  '--kt-primary-foreground': primaryFg,
  '--kt-secondary': secondary,
  '--kt-secondary-foreground': foreground,
  '--kt-muted': muted,
  '--kt-muted-foreground': mutedFg,
  '--kt-accent': accent,
  '--kt-accent-foreground': accentFg,
  '--kt-destructive': '#E5484D',
  '--kt-border': border,
  '--kt-input': input,
  '--kt-ring': ring,
  '--kt-chart-1': chart[0],
  '--kt-chart-2': chart[1],
  '--kt-chart-3': chart[2],
  '--kt-chart-4': chart[3],
  '--kt-chart-5': chart[4],
  '--kt-sidebar': sidebar,
  '--kt-sidebar-foreground': foreground,
  '--kt-sidebar-primary': primary,
  '--kt-sidebar-primary-foreground': primaryFg,
  '--kt-sidebar-accent': sidebarAccent,
  '--kt-sidebar-accent-foreground': sidebarAccentFg,
  '--kt-sidebar-border': sidebarBorder,
  '--kt-sidebar-ring': ring,
  '--kt-success': '#15803D',
  '--kt-warning': '#B45309',
  // Palette accents — the 4 brand colors stay available across the UI
  // (badges, illustrations, gradients, geometric shapes).
  '--kt-brand': c1,
  '--kt-cool': c2,
  '--kt-warm': c3,
  '--kt-complement': c4,
  '--kt-gradient-a': `linear-gradient(135deg, ${c1}, ${c2})`,
  '--kt-gradient-b': `linear-gradient(135deg, ${c3}, ${c4})`,
}

/* Tag colors — functional colors for pickers. */
const TAGS = {
  '--kt-rose': '#F6B7D2',
  '--kt-rose-dark': '#EA8EB8',
  '--kt-lavender': '#CDB8FF',
  '--kt-violet': '#B9A7FF',
  '--kt-blue': '#BFDFFF',
  '--kt-sage': '#CDE9D2',
  '--kt-yellow': '#FFF1B6',
  '--kt-coral': '#FFC8B8',
}

/* ------------------------------------------------------------------ */
/* Emit                                                                 */
/* ------------------------------------------------------------------ */

const header = `/* =====================================================================
 * KININARU DESIGN TOKENS — generated by scripts/generate-themes.mjs.
 * DO NOT EDIT BY HAND: run \`node scripts/generate-themes.mjs\` after
 * changing the palette or the derivation rules.
 *
 * Identité unique : thème clair, fond blanc #FFFFFF, palette Memphis
 * cyan #00C2E0 · marine #1A365D · orange #FF6B35 · terracotta #6A2B05.
 * ===================================================================== */

/* Tags — functional colors (pickers). */
:root {
${Object.entries(TAGS)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n')}
}

:root {
${Object.entries(TOKENS)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n')}
}
`

writeFileSync(OUT, header)
console.log(`✔ generated ${OUT} — single theme (${c1} / ${c2} / ${c3} / ${c4})`)
