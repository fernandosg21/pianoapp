import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { Health } from '../types'

/**
 * Estado da máquina, em uma linha.
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
    return (
      <span className="flex items-center gap-2 text-xs text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-felt" />
        backend fora do ar
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2 text-xs text-ink-faint">
      <span className={`h-1.5 w-1.5 rounded-full ${health.gpu ? 'bg-brass' : 'bg-rule-strong'}`} />
      {health.gpu ? (
        <>
          <span className="text-ink-soft">{health.gpu_name}</span>
          {health.vram_free_mb != null && health.vram_total_mb != null && (
            <span className="tabular">
              {Math.round(health.vram_free_mb / 1024)}/{Math.round(health.vram_total_mb / 1024)} GB
            </span>
          )}
        </>
      ) : (
        <span>em CPU</span>
      )}
    </span>
  )
}
