// Kininaru is a French-only app, but date-fns defaults to English when no
// locale is passed to `format`/`formatDistanceToNow`. That silently produced
// English weekday/month names ("Friday, August 7", "Mon", "Jan") everywhere
// dates were rendered, even though every other string in the UI is French.
// These wrappers bake in the French locale so call sites don't have to
// remember to pass `{ locale: fr }` every time — just import `format` /
// `formatDistanceToNow` from here instead of from 'date-fns'.
import { fr } from 'date-fns/locale'
import {
  format as formatBase,
  formatDistanceToNow as formatDistanceToNowBase,
  formatRelative as formatRelativeBase,
} from 'date-fns'

type FormatOptions = NonNullable<Parameters<typeof formatBase>[2]>
type DistanceOptions = NonNullable<Parameters<typeof formatDistanceToNowBase>[1]>
type RelativeOptions = NonNullable<Parameters<typeof formatRelativeBase>[2]>

export function format(date: Date | number, formatStr: string, options?: FormatOptions) {
  return formatBase(date, formatStr, { locale: fr, ...options })
}

export function formatDistanceToNow(date: Date | number, options?: DistanceOptions) {
  return formatDistanceToNowBase(date, { locale: fr, ...options })
}

export function formatRelative(date: Date | number, baseDate: Date | number, options?: RelativeOptions) {
  return formatRelativeBase(date, baseDate, { locale: fr, ...options })
}
