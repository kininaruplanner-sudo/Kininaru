'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  THEMES,
  THEME_STORAGE_KEY,
  THEME_DEFAULT,
  isThemeValue,
  themeMeta,
} from '@/lib/themes'

export type ThemeValue = string

interface ThemeContextValue {
  theme: ThemeValue
  setTheme: (theme: ThemeValue) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEME_DEFAULT,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeValue>(THEME_DEFAULT)

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeValue(stored)) {
      setThemeState(stored)
    }
  }, [])

  const setTheme = (next: ThemeValue) => {
    if (!isThemeValue(next)) return
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Meta theme-color cohérente avec le thème actif : les barres de statut
  // mobile et les fenêtres PWA standalone suivent le fond du thème.
  useEffect(() => {
    const color = themeMeta(theme).bg
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = color
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { THEMES }
