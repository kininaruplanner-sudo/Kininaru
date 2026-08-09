'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = [
  { value: 'navy', label: 'Bleu Foncé', swatches: ['#F7F9FC', '#2F3F63', '#BFDFFF'] },
  { value: 'rose', label: 'Rose Doux', swatches: ['#FFF9FC', '#F6B7D2', '#CDB8FF'] },
  { value: 'lavender', label: 'Lavande', swatches: ['#FBF9FF', '#B9A7FF', '#BFDFFF'] },
  { value: 'sage', label: 'Sauge', swatches: ['#F9FCFA', '#9BC7A4', '#FFF1B6'] },
  { value: 'ocean', label: 'Ocean', swatches: ['#F8FBFF', '#8FC1EF', '#CDE9D2'] },
  { value: 'dark', label: 'Sombre', swatches: ['#16161F', '#6C86C4', '#C9A8FF'] },
] as const

export type ThemeValue = (typeof THEMES)[number]['value']

const STORAGE_KEY = 'kininaru-theme'
const DEFAULT_THEME: ThemeValue = 'navy'

interface ThemeContextValue {
  theme: ThemeValue
  setTheme: (theme: ThemeValue) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeValue>(DEFAULT_THEME)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeValue | null
    if (stored && THEMES.some((t) => t.value === stored)) {
      setThemeState(stored)
    }
  }, [])

  const setTheme = (next: ThemeValue) => {
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
