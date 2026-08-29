import { lazy, Suspense, useState } from 'react'

import { usePlayback } from '../hooks/usePlayback'
import { api } from '../lib/api'
import type { Notation } from '../lib/notes'
import type { Transcription } from '../types'
import { NoteList } from './NoteList'
import { PianoRoll } from './PianoRoll'
import { Transport } from './Transport'

// O VexFlow responde pela maior parte do bundle e só serve à aba de partitura,
// então só é baixado quando ela é aberta.
const Score = lazy(() => import('./Score').then((m) => ({ default: m.Score })))

type Tab = 'roll' | 'list' | 'score'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'roll', label: 'Piano roll' },
  { id: 'list', label: 'Lista de notas' },
  { id: 'score', label: 'Partitura' },
]

interface Props {
  jobId: string
  transcription: Transcription
  onReprocess: (force: 'solo' | 'dense_mix') => void
}

export function Result({ jobId, transcription, onReprocess }: Props) {
  const [tab, setTab] = useState<Tab>('roll')
  const [notation, setNotation] = useState<Notation>('letters')
  const playback = usePlayback(api.audioUrl(jobId))

  const otherRoute = transcription.route === 'solo' ? 'dense_mix' : 'solo'

  return (
    <div className="space-y-4">
      <Transport
        playing={playback.playing}
        currentTime={playback.displayTime}
        duration={playback.duration || transcription.duration}
        rate={playback.rate}
        onToggle={playback.toggle}
        onSeek={playback.seek}
        onRate={playback.setRate}
        onVolume={playback.setVolume}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded px-3 py-1.5 text-sm ${
                tab === item.id ? 'bg-sky-600 text-white' : 'border border-edge hover:bg-panel'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setNotation('letters')}
            className={`rounded px-2 py-1 ${
              notation === 'letters' ? 'bg-slate-700 text-white' : 'border border-edge'
            }`}
          >
            C D E
          </button>
          <button
            onClick={() => setNotation('solfege')}
            className={`rounded px-2 py-1 ${
              notation === 'solfege' ? 'bg-slate-700 text-white' : 'border border-edge'
            }`}
          >
            Dó Ré Mi
          </button>
        </div>

        <a
          href={api.midiUrl(jobId)}
          className="rounded border border-edge px-3 py-1.5 text-sm hover:bg-panel"
        >
          Baixar MIDI
        </a>
      </div>

      {tab === 'roll' && <PianoRoll notes={transcription.notes} timeRef={playback.timeRef} />}
      {tab === 'list' && (
        <NoteList
          notes={transcription.notes}
          notation={notation}
          currentTime={playback.displayTime}
          onSeek={playback.seek}
        />
      )}
      {tab === 'score' && (
        <Suspense fallback={<p className="text-slate-400">Carregando a pauta…</p>}>
          <Score transcription={transcription} />
        </Suspense>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-slate-400">
        <span>
          {transcription.notes.length} notas · {transcription.tempo} BPM ·{' '}
          rota <strong className="text-slate-200">
            {transcription.route === 'solo' ? 'instrumento solo' : 'mixagem densa'}
          </strong>
          {' · '}{transcription.device === 'cpu' ? 'CPU' : transcription.device.toUpperCase()}
          {transcription.pedal.length > 0 && ` · ${transcription.pedal.length} eventos de pedal`}
        </span>
        {/* A triagem é heurística e vai errar em casos de borda; sem esta saída,
            um erro de classificação vira um resultado ruim inexplicável. */}
        <button
          onClick={() => onReprocess(otherRoute)}
          className="rounded border border-edge px-2 py-1 hover:bg-white/5"
        >
          Reprocessar como {otherRoute === 'solo' ? 'instrumento solo' : 'mixagem densa'}
        </button>
      </div>
    </div>
  )
}
