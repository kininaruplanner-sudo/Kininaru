/**
 * Kininaru — theme token generator.
 *
 * Turns every 4-color palette into a full design system (background,
 * foreground, cards, borders, muted, primary, secondary, accent, charts,
 * sidebar, ring…) and writes `app/themes.css` (committed).
 *
 * Design rules:
 *  - c1 = brand / primary actions
 *  - c2 = secondary accent (hover, highlights)
 *  - c3 = warm accent (secondary actions, illustrations)
 *  - c4 = complementary (charts, states, badges)
 *  - neutrals are DERIVED from c1 (tinted, never pure gray) so every theme
 *    keeps its own identity without a monochrome page;
 *  - every foreground is contrast-checked against its background (≥ 4.5:1
 *    for text, ≥ 3:1 for large/charts) — light palettes get dark foregrounds,
 *    dark palettes get light foregrounds;
 *  - chart colors are darkened when the source palette color is too pale to
 *    be visible as a stroke/dot on white.
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
/* Theme definitions — 35 themes (default Kininaru + 33 palettes + Nuit) */
/* ------------------------------------------------------------------ */

// [value, label, c1 brand, c2 secondary accent, c3 warm accent, c4 complementary]
const PALETTES = [
  // Kininaru brand — Memphis moderne : cyan #00C2E0, marine #1A365D,
  // orange vif #FF6B35, terracotta #6A2B05.
  ['kininaru', 'Kininaru', '#00C2E0', '#1A365D', '#FF6B35', '#6A2B05'],
  ['savane', 'Savane', '#B5C99A', '#862B0D', '#FFF9C9', '#FFC95F'],
  ['lagoon', 'Lagoon', '#3AA6B9', '#FFD0D0', '#FF9EAA', '#C1ECE4'],
  ['indigo', 'Indigo', '#525FE1', '#F86F03', '#FFA41B', '#FFF6F4'],
  ['terracotta', 'Terracotta', '#B31312', '#EA906C', '#EEE2DE', '#2B2A4C'],
  ['citrus', 'Citrus', '#F29727', '#F24C3D', '#22A699', '#F2BE22'],
  ['berry', 'Berry', '#E966A0', '#2B2730', '#9575DE', '#6554AF'],
  ['tropical', 'Tropical', '#068DA9', '#ECF8F9', '#E55807', '#7E1717'],
  ['candy', 'Candy', '#A459D1', '#F266AB', '#2CD3E1', '#FFB84C'],
  ['forest', 'Forest', '#1B9C85', '#4C4C6D', '#E8F6EF', '#FFE194'],
  ['vintage', 'Vintage', '#A75377', '#D3775D', '#DFB361', '#F5EB82'],
  ['bordeaux', 'Bordeaux', '#E2434B', '#34222E', '#F9BF8F', '#FEE9D7'],
  ['amber', 'Amber', '#ED733F', '#FFAF4F', '#433466', '#824C96'],
  ['rose-quartz', 'Rose Quartz', '#C65F63', '#F6E1B8', '#84577C', '#333644'],
  ['coral', 'Coral', '#F67E7D', '#FFB997', '#843B62', '#0B032D'],
  ['sage', 'Sauge', '#427A5B', '#B4CD93', '#FCF5B8', '#403F3F'],
  ['poppy', 'Coquelicot', '#FE5F55', '#FFF1C1', '#293462', '#A64942'],
  ['marine', 'Marine', '#1A2639', '#3E4A61', '#C24D2C', '#D9DAD7'],
  ['seafoam', 'Seafoam', '#9DCDCD', '#FFF4E1', '#E67A7A', '#FFEBB7'],
  ['cafe', 'Café', '#4E413B', '#E2DED3', '#FF6D24', '#857671'],
  ['mango', 'Mangue', '#00A79D', '#F5C181', '#FFEECF', '#007065'],
  ['flamingo', 'Flamingo', '#B83B5E', '#F9ED69', '#F08A5D', '#6A2C70'],
  ['curcuma', 'Curcuma', '#FCC97B', '#FAFB97', '#5F4E9E', '#402785'],
  ['aqua', 'Aqua', '#73B9D7', '#9DE6E8', '#FFD79A', '#FFFAC0'],
  ['sky', 'Sky', '#448EF6', '#75C2F6', '#65DAF7', '#FFE981'],
  ['fuchsia', 'Fuchsia', '#D527B7', '#FF82C3', '#8A00D4', '#FFC46B'],
  ['lime', 'Lime', '#51DACF', '#9EF5CF', '#48829E', '#E8FFB1'],
  ['pistache', 'Pistache', '#79BD8F', '#BEEB9F', '#FFFF9D', '#FF6138'],
  ['creme', 'Crème', '#FBD1B7', '#FEE9B2', '#D3F6F3', '#F9FCE1'],
  ['violette', 'Violette', '#A73CCB', '#E85395', '#FF9071', '#FFF5B5'],
  ['limonade', 'Limonade', '#41EECB', '#FCD78E', '#20DECB', '#F9F296'],
  ['orchid', 'Orchidée', '#BA52ED', '#FF99FE', '#A4F6F9', '#E4FFFE'],
  ['prune', 'Prune', '#690074', '#9B3284', '#F677C1', '#F1E290'],
  ['rose', 'Rose', '#F54291', '#FFA0D2', '#FFB8CD', '#FF78AE'],
  ['nuit', 'Nuit', '#6C86C4', '#C9A8FF', '#8FD1FF', '#9FE0AE'],
]

/* ------------------------------------------------------------------ */
/* Token derivation (light themes)                                     */
/* ------------------------------------------------------------------ */

const WHITE = '#FFFFFF'

function buildLightTheme([c1, c2, c3, c4]) {
  // Fond blanc épuré (#FFFFFF) sur toutes les pages — la charte est
  // harmonisée ; seuls les accents (cartes, sidebar, muted) gardent une
  // teinte légère de la palette pour conserver l'identité du thème.
  const background = WHITE
  // Texte (titres compris) dérivé de c2 (accent secondaire) : pour la
  // palette Kininaru c2 = marine #1A365D → titres en bleu marine.
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

  return {
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
    // Palette accents — the 4 colors stay available across the UI (badges,
    // illustrations, gradients) so every theme shows its full identity.
    '--kt-brand': c1,
    '--kt-cool': c2,
    '--kt-warm': c3,
    '--kt-complement': c4,
    '--kt-gradient-a': `linear-gradient(135deg, ${c1}, ${c2})`,
    '--kt-gradient-b': `linear-gradient(135deg, ${c3}, ${c4})`,
  }
}

/* Dark theme (Nuit) — kept from the previous system, expanded. */
const DARK = {
  'color-scheme': 'dark',
  '--kt-background': '#16161F',
  '--kt-foreground': '#ECE9F1',
  '--kt-card': '#1E1E29',
  '--kt-card-foreground': '#ECE9F1',
  '--kt-popover': '#1E1E29',
  '--kt-popover-foreground': '#ECE9F1',
  '--kt-primary': '#6C86C4',
  '--kt-primary-foreground': '#FFFFFF',
  '--kt-secondary': '#24242F',
  '--kt-secondary-foreground': '#ECE9F1',
  '--kt-muted': '#24242F',
  '--kt-muted-foreground': '#9A96A8',
  '--kt-accent': '#2C2A3C',
  '--kt-accent-foreground': '#C9A8FF',
  '--kt-destructive': '#F08497',
  '--kt-border': '#2C2C38',
  '--kt-input': '#2A2A35',
  '--kt-ring': '#6C86C4',
  '--kt-chart-1': '#6C86C4',
  '--kt-chart-2': '#C9A8FF',
  '--kt-chart-3': '#8FD1FF',
  '--kt-chart-4': '#9FE0AE',
  '--kt-chart-5': '#FFE187',
  '--kt-sidebar': '#1B1B25',
  '--kt-sidebar-foreground': '#ECE9F1',
  '--kt-sidebar-primary': '#6C86C4',
  '--kt-sidebar-primary-foreground': '#FFFFFF',
  '--kt-sidebar-accent': '#262631',
  '--kt-sidebar-accent-foreground': '#9FB3E8',
  '--kt-sidebar-border': '#2C2C38',
  '--kt-sidebar-ring': '#6C86C4',
  '--kt-success': '#4ADE80',
  '--kt-warning': '#FBBF24',
  '--kt-brand': '#8FA9C9',
  '--kt-cool': '#C9A8FF',
  '--kt-warm': '#8FD1FF',
  '--kt-complement': '#9FE0AE',
  '--kt-gradient-a': 'linear-gradient(135deg, #6C86C4, #C9A8FF)',
  '--kt-gradient-b': 'linear-gradient(135deg, #8FD1FF, #9FE0AE)',
}

/* Tag colors — constant across themes (functional colors for pickers). */
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

function emitBlock(selector, tokens) {
  const lines = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `${selector} {\n${lines}\n}\n`
}

const header = `/* =====================================================================
 * KININARU THEMES — generated by scripts/generate-themes.mjs.
 * DO NOT EDIT BY HAND: run \`node scripts/generate-themes.mjs\` after
 * changing a palette or the derivation rules.
 *
 * Every theme exposes the full design-token set (background, foreground,
 * cards, borders, muted, primary, secondary, accent, success, warning,
 * destructive, charts, sidebar, ring + gradients) derived from its 4-color
 * palette with contrast-checked foregrounds.
 * ===================================================================== */

/* Tags — identical across themes (functional picker colors). */
:root {
${Object.entries(TAGS)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n')}
}

`

let css = header
for (const [value, , ...colors] of PALETTES) {
  const tokens = value === 'nuit' ? DARK : buildLightTheme(colors)
  const selector = value === 'kininaru' ? ':root, [data-theme="kininaru"]' : `[data-theme="${value}"]`
  css += `\n${emitBlock(selector, tokens)}`
}

writeFileSync(OUT, css)
console.log(`✔ generated ${OUT} — ${PALETTES.length} themes`)
