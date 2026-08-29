import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { Health } from '../types'

/**
 * Faixa de status.
 *
 * Quando a transcrição estiver lenta, isto responde na hora a pergunta certa:
 * está usando a GPU ou caiu para CPU?
 */
export function HealthBar() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    const load = () => api.health().then(setHealth).catch(() => setHealth(null))
    load()
    const timer = window.setInterval(load, 15000)
    return () => window.clearInterval(timer)
  }, [])

  if (!health) {
    return <span className="text-xs text-slate-500">backend indisponível</span>
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${health.gpu ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {health.gpu ? (
        <span className="text-slate-400">
          {health.gpu_name}
          {health.vram_free_mb != null && health.vram_total_mb != null && (
            <span className="text-slate-500">
              {' '}· {Math.round(health.vram_free_mb / 1024)} de{' '}
              {Math.round(health.vram_total_mb / 1024)} GB livres
            </span>
          )}
        </span>
      ) : (
        <span className="text-slate-400">
          rodando em CPU — mais lento; confira o passthrough de GPU
        </span>
      )}
    </span>
  )
}
