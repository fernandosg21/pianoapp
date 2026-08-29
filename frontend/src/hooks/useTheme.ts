import { useCallback, useEffect, useState } from 'react'

export type Theme = 'night' | 'paper'

const STORAGE_KEY = 'pianoapp:theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'night' || saved === 'paper') return saved
  } catch {
    // Safari em navegação privada bloqueia o storage; seguimos pelo sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'paper' : 'night'
}

/**
 * Sala de piano à noite, partitura em papel de dia.
 *
 * Os dois cenários de estudo são reais, e nenhum serve bem ao outro: papel ofusca
 * num quarto escuro, e o escuro some sob a luz da janela.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Sem persistência: a escolha vale só para esta sessão.
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'night' ? 'paper' : 'night'))
  }, [])

  return { theme, toggle }
}
