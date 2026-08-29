import type { Loop } from '../hooks/usePlayback'
import { formatTime } from '../lib/notes'
import { Scrubber } from './Scrubber'

interface Props {
  playing: boolean
  currentTime: number
  duration: number
  rate: number
  loop: Loop
  compact: boolean
  onToggle: () => void
  onSeek: (seconds: number) => void
  onRate: (rate: number) => void
  onMarkA: () => void
  onMarkB: () => void
  onToggleLoop: () => void
  onClearLoop: () => void
}

const RATES = [0.5, 0.65, 0.8, 1]

/**
 * O que a pessoa toca enquanto estuda.
 *
 * Estudar é repetir um trecho devagar até a mão aprender, então o laço A-B e a
 * velocidade ficam no primeiro plano. Duas fileiras e não uma: espremido entre os
 * botões, o cursor de posição ficava curto demais para achar um compasso com o
 * dedo, e os dois grupos de botões viravam uma fileira só, indistinguível.
 */
export function PracticeBar({
  playing, currentTime, duration, rate, loop, compact,
  onToggle, onSeek, onRate, onMarkA, onMarkB, onToggleLoop, onClearLoop,
}: Props) {
  const hasLoop = loop.a !== null && loop.b !== null

  return (
    <div className="surface space-y-2 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="h-12 w-12 shrink-0 rounded-full border border-brass bg-tint-brass text-lg text-brass-bright transition-colors hover:bg-tint-brass-strong active:bg-tint-brass-strong"
          aria-label={playing ? 'Pausar' : 'Tocar'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <span className="tabular shrink-0 text-sm text-ink-soft">
          {formatTime(currentTime)}
          <span className="text-ink-faint"> / {formatTime(duration)}</span>
        </span>

        <Scrubber currentTime={currentTime} duration={duration} loop={loop} onSeek={onSeek} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-1">
        {/* Laço A-B: o gesto central do estudo, agrupado como um controle só. */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-faint">trecho</span>
          <div className="flex overflow-hidden rounded border border-rule">
            <button
              onClick={onMarkA}
              className="segment font-mono"
              data-active={loop.a !== null}
              title="Marcar o início do trecho no ponto atual"
            >
              A
            </button>
            <button
              onClick={onMarkB}
              className="segment font-mono border-l border-rule"
              data-active={loop.b !== null}
              disabled={loop.a === null}
              title="Marcar o fim do trecho no ponto atual"
            >
              B
            </button>
            <button
              onClick={onToggleLoop}
              className="segment border-l border-rule"
              aria-pressed={loop.enabled}
              disabled={!hasLoop}
              title="Repetir o trecho"
            >
              ↻
            </button>
            <button
              onClick={onClearLoop}
              className="segment border-l border-rule"
              disabled={!hasLoop}
              title="Limpar o trecho"
            >
              ✕
            </button>
          </div>
          {hasLoop && !compact && (
            <span className="tabular text-xs text-ink-faint">
              {formatTime(loop.a!)}–{formatTime(loop.b!)}
              {loop.enabled ? ' repetindo' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-faint">andamento</span>
          <div className="flex overflow-hidden rounded border border-rule">
            {/* Tocar devagar é o que torna o app útil para estudar de fato. */}
            {RATES.map((value, i) => (
              <button
                key={value}
                onClick={() => onRate(value)}
                className={`segment tabular ${i > 0 ? 'border-l border-rule' : ''}`}
                data-active={rate === value}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
