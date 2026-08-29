import { formatTime } from '../lib/notes'

interface Props {
  playing: boolean
  currentTime: number
  duration: number
  rate: number
  onToggle: () => void
  onSeek: (seconds: number) => void
  onRate: (rate: number) => void
  onVolume: (value: number) => void
}

const RATES = [0.5, 0.75, 1]

export function Transport({
  playing, currentTime, duration, rate, onToggle, onSeek, onRate, onVolume,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-edge bg-panel px-4 py-3">
      <button
        onClick={onToggle}
        className="h-10 w-10 rounded-full bg-sky-600 text-lg font-bold text-white hover:bg-sky-500"
        aria-label={playing ? 'Pausar' : 'Tocar'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <span className="w-24 tabular-nums text-sm text-slate-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.01}
        value={Math.min(currentTime, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1 min-w-[200px] flex-1 accent-sky-500"
        aria-label="Posição"
      />

      <div className="flex items-center gap-1 text-sm">
        {/* Tocar devagar é o que torna o app útil para estudar de fato. */}
        {RATES.map((value) => (
          <button
            key={value}
            onClick={() => onRate(value)}
            className={`rounded px-2 py-1 ${
              rate === value ? 'bg-sky-600 text-white' : 'border border-edge hover:bg-white/5'
            }`}
          >
            {value}×
          </button>
        ))}
      </div>

      <input
        type="range" min={0} max={1} step={0.01} defaultValue={1}
        onChange={(e) => onVolume(Number(e.target.value))}
        className="h-1 w-24 accent-sky-500"
        aria-label="Volume"
      />
    </div>
  )
}
