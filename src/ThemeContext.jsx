import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES } from './theme.js'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('geocoins_theme') || 'light')
  const theme = THEMES[mode] || THEMES.light

  useEffect(() => { localStorage.setItem('geocoins_theme', mode) }, [mode])

  const toggle = () => setMode(m => m === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext)
