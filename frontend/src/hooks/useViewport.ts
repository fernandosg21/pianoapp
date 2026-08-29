import { useEffect, useState } from 'react'

export interface Viewport {
  width: number
  height: number
  /** iPad em retrato e telas menores: layout precisa empilhar. */
  narrow: boolean
  /** Pouca altura útil (iPad em paisagem, ~700 px): o piano roll precisa encolher. */
  short: boolean
}

function read(): Viewport {
  const width = window.innerWidth
  const height = window.innerHeight
  return { width, height, narrow: width < 820, short: height < 760 }
}

/** Acompanha o tamanho da janela, incluindo rotação do tablet. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read)

  useEffect(() => {
    const update = () => setViewport(read())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return viewport
}
