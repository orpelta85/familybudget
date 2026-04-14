'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    if (saved === 'light' || saved === 'dark') setThemeRaw(saved)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, mounted])

  const toggleTheme = useCallback(() => {
    setThemeRaw(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t)
  }, [])

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
