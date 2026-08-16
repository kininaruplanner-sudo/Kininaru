/**
 * Kininaru themes — single source of truth for the picker and the provider.
 *
 * The full design tokens per theme are GENERATED from these 4-color
 * palettes into app/themes.css (scripts/generate-themes.mjs). This module
 * only carries what the client needs: value, display name, the 4 swatches
 * and the derived background (for the browser theme-color meta).
 */

export interface ThemeMeta {
  value: string
  name: string
  /** [c1 brand, c2 cool accent, c3 warm accent, c4 complement] */
  colors: [string, string, string, string]
  /** Light background derived from c1 (matches themes.css). */
  bg: string
}

// [value, name, c1, c2, c3, c4]
const RAW: [string, string, string, string, string, string][] = [
  // Kininaru brand — Memphis moderne : cyan, marine, orange vif, terracotta.
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

export const THEMES: ThemeMeta[] = RAW.map(([value, name, c1, c2, c3, c4]) => ({
  value,
  name,
  colors: [c1, c2, c3, c4],
  // Fond blanc épuré (#FFFFFF) pour toutes les déclinaisons claires.
  bg: value === 'nuit' ? '#16161F' : '#FFFFFF',
}))

export const THEME_STORAGE_KEY = 'kininaru-theme'
export const THEME_DEFAULT = 'kininaru'

export function isThemeValue(raw: unknown): raw is string {
  return typeof raw === 'string' && THEMES.some((t) => t.value === raw)
}

export function themeMeta(value: string): ThemeMeta {
  return THEMES.find((t) => t.value === value) ?? THEMES[0]
}
