import { lazy, Suspense, useState } from 'react'

import { usePlayback } from '../hooks/usePlayback'
import type { Theme } from '../hooks/useTheme'
import { useViewport } from '../hooks/useViewport'
import { useWakeLock } from '../hooks/useWakeLock'
import { api } from '../lib/api'
import type { Notation } from '../lib/notes'
import type { Route, Transcription } from '../types'
import { NoteList } from './NoteList'
import { PianoRoll } from './PianoRoll'
import { PracticeBar } from './PracticeBar'

// O VexFlow responde pela maior parte do bundle e só serve à aba de partitura,
// então só é baixado quando ela é aberta.
const Score = lazy(() => import('./Score').then((m) => ({ default: m.Score })))

type View = 'roll' | 'list' | 'score'

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'roll', label: 'Teclado' },
  { id: 'list', label: 'Notas' },
  { id: 'score', label: 'Partitura' },
]

interface Props {
  jobId: string
  transcription: Transcription
  theme: Theme
  onReprocess: (force: Route) => void
}

export function Result({ jobId, transcription, theme, onReprocess }: Props) {
  const [view, setView] = useState<View>('roll')
  const [notation, setNotation] = useState<Notation>('letters')
  const playback = usePlayback(api.audioUrl(jobId))
  const viewport = useViewport()

  // Segura a tela enquanto toca: estudar é olhar o piano roll por minutos sem
  // encostar na tela, e o bloqueio automático cortaria isso.
  const wakeLock = useWakeLock(playback.playing)

  const otherRoute: Route = transcription.route === 'solo' ? 'dense_mix' : 'solo'
  // Reserva o espaço da barra de prática, das visões e do rodapé; o resto é palco.
  // O teto é alto porque num iPad em retrato sobra altura, e rolo mais alto é mais
  // tempo à frente na tela — dá para ler a frase seguinte antes de tocá-la.
  const rollHeight = Math.round(
    Math.max(240, Math.min(680, viewport.height - (viewport.short ? 300 : 370))),
  )

  return (
    <div className="space-y-4">
      <PracticeBar
        playing={playback.playing}
        currentTime={playback.displayTime}
        duration={playback.duration || transcription.duration}
        rate={playback.rate}
        loop={playback.loop}
        compact={viewport.narrow}
        onToggle={playback.toggle}
        onSeek={playback.seek}
        onRate={playback.setRate}
        onMarkA={playback.markA}
        onMarkB={playback.markB}
        onToggleLoop={playback.toggleLoop}
        onClearLoop={playback.clearLoop}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* As visões são secundárias à prática: sublinhadas em feltro, sem peso de botão. */}
        <div className="flex gap-1">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`font-display min-h-[44px] border-b-2 px-3 text-[0.95rem] transition-colors ${
                view === item.id
                  ? 'border-felt text-ink'
                  : 'border-transparent text-ink-faint hover:text-ink-soft'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded border border-rule">
            {(['letters', 'solfege'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setNotation(option)}
                className={`min-h-[44px] px-3 text-sm transition-colors ${
                  notation === option
                    ? 'bg-tint-brass text-brass-bright'
                    : 'text-ink-faint hover:text-ink-soft'
                }`}
              >
                {option === 'letters' ? 'C D E' : 'Dó Ré Mi'}
              </button>
            ))}
          </div>
          <a href={api.midiUrl(jobId)} className="control">
            MIDI
          </a>
        </div>
      </div>

      {view === 'roll' && (
        <PianoRoll
          notes={transcription.notes}
          timeRef={playback.timeRef}
          loop={playback.loop}
          theme={theme}
          height={rollHeight}
        />
      )}
      {view === 'list' && (
        <NoteList
          notes={transcription.notes}
          notation={notation}
          currentTime={playback.displayTime}
          onSeek={playback.seek}
        />
      )}
      {view === 'score' && (
        <Suspense fallback={<p className="text-ink-faint">Carregando a pauta…</p>}>
          <Score transcription={transcription} theme={theme} />
        </Suspense>
      )}

      {wakeLock === 'insecure' && playback.playing && (
        <p className="surface px-4 py-2 text-xs text-ink-faint">
          Fora de HTTPS o navegador não deixa segurar a tela acesa. Para estudar sem
          interrupção, desative o bloqueio automático do iPad em{' '}
          <span className="text-ink-soft">Ajustes › Tela e Brilho › Bloqueio Automático › Nunca</span>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-faint">
        <span>
          <span className="tabular text-ink-soft">{transcription.notes.length}</span> notas
        </span>
        <span>
          <span className="tabular text-ink-soft">{Math.round(transcription.tempo)}</span> BPM
        </span>
        <span>
          rota{' '}
          <span className="text-ink-soft">
            {transcription.route === 'solo' ? 'instrumento solo' : 'mixagem densa'}
          </span>
        </span>
        <span>{transcription.device === 'cpu' ? 'CPU' : transcription.device.toUpperCase()}</span>
        {transcription.pedal.length > 0 && (
          <span>
            <span className="tabular text-ink-soft">{transcription.pedal.length}</span> pedais
          </span>
        )}
        {wakeLock === 'active' && <span className="text-brass">tela travada acesa</span>}
        {/* A triagem é heurística e vai errar em casos de borda; sem esta saída,
            um erro de classificação vira um resultado ruim inexplicável. */}
        <button
          onClick={() => onReprocess(otherRoute)}
          className="ml-auto underline decoration-rule-strong underline-offset-4 hover:text-ink-soft"
        >
          reprocessar como {otherRoute === 'solo' ? 'instrumento solo' : 'mixagem densa'}
        </button>
      </div>
    </div>
  )
}
