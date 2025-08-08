import React, { createContext, JSX, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<Theme>('system')
  const [isDark, setIsDark] = useState<boolean>(false)

  useEffect(() => {
    // Load initial theme
    loadTheme()
  }, [])

  useEffect(() => {
    // Apply theme changes
    applyTheme()
  }, [theme])

  const loadTheme = async (): Promise<void> => {
    try {
      if (window.api && typeof window.api.getTheme === 'function') {
        const savedTheme = await window.api.getTheme()
        setTheme(savedTheme as Theme)
      }
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  }

  const applyTheme = (): void => {
    const root = window.document.documentElement

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(systemPrefersDark)
      root.classList.toggle('dark', systemPrefersDark)
    } else {
      const shouldBeDark = theme === 'dark'
      setIsDark(shouldBeDark)
      root.classList.toggle('dark', shouldBeDark)
    }
  }

  const handleSetTheme = async (newTheme: Theme): Promise<void> => {
    setTheme(newTheme)
    try {
      if (window.api && typeof window.api.setTheme === 'function') {
        await window.api.setTheme(newTheme)
      }
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  // Listen for system theme changes
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (): void => applyTheme()

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Return undefined explicitly when theme is not 'system'
    return undefined
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
