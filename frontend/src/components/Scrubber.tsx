import { useCallback, useRef } from 'react'

import type { Loop } from '../hooks/usePlayback'

interface Props {
  currentTime: number
  duration: number
  loop: Loop
  onSeek: (seconds: number) => void
}

/**
 * A linha do tempo, desenhada como a tira de feltro.
 *
 * Controle próprio e não <input type="range"> porque o nativo não mostra o trecho
 * em repetição — e é justamente o trecho que interessa durante o estudo. A área de
 * toque tem 44 px de altura, embora a linha visível seja fina: mirar um fio de
 * 3 px com o dedo, no meio de uma frase, é impossível.
 */
export function Scrubber({ currentTime, duration, loop, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const span = Math.max(duration, 0.001)

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const { left, width } = track.getBoundingClientRect()
      onSeek(((clientX - left) / width) * span)
    },
    [onSeek, span],
  )

  const percent = (value: number) => `${Math.min(100, Math.max(0, (value / span) * 100))}%`

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Posição na música"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      className="relative h-11 min-w-[180px] flex-1 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromEvent(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.buttons > 0) seekFromEvent(e.clientX)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5))
        if (e.key === 'ArrowRight') onSeek(Math.min(span, currentTime + 5))
      }}
    >
      {/* O trilho: o feltro, atenuado até virar sulco. */}
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-rule" />

      {/* O que já passou. */}
      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-felt"
        style={{ width: percent(currentTime) }}
      />

      {/* O trecho em repetição. */}
      {loop.a !== null && loop.b !== null && (
        <div
          className={`absolute top-1/2 h-[9px] -translate-y-1/2 rounded-sm border ${
            loop.enabled ? 'border-brass bg-tint-brass' : 'border-rule-strong bg-transparent'
          }`}
          style={{
            left: percent(loop.a),
            width: `calc(${percent(loop.b)} - ${percent(loop.a)})`,
          }}
        />
      )}

      {/* O martelo: onde estamos agora. */}
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-bright"
        style={{ left: percent(currentTime) }}
      />
    </div>
  )
}
