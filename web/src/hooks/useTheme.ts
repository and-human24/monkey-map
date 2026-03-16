import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('monkey-map-theme')
    return stored === 'light' || stored === 'dark' ? stored : 'light'
  })

  useEffect(() => {
    localStorage.setItem('monkey-map-theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}
