import { useRef, useState } from 'react'

import { api } from '../lib/api'
import type { Mode } from '../types'

interface Props {
  onStarted: (jobId: string) => void
}

const MODES: Array<{ value: Mode; title: string; detail: string; estimate: string }> = [
  {
    value: 'precise',
    title: 'Máxima precisão',
    detail:
      'Escolhe sozinho o melhor caminho: instrumento solo vai ao modelo dedicado a piano; ' +
      'mixagem densa é separada em instrumentos antes de transcrever.',
    estimate: '1 a 5 min',
  },
  {
    value: 'fast',
    title: 'Rápido',
    detail: 'Um passe multi-instrumento, sem separação de fontes. Serve para uma prévia.',
    estimate: '10 a 30 s',
  },
]

export function Upload({ onStarted }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<Mode>('precise')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const send = async (file: File) => {
    setError(null)
    setSending(true)
    try {
      const { job_id } = await api.transcribe(file, mode)
      onStarted(job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-4">
        <h2 className="font-display text-2xl">Uma gravação vira notas de piano</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-md border p-4 text-left transition-colors ${
                mode === option.value
                  ? 'border-brass bg-tint-brass'
                  : 'border-rule bg-case hover:border-rule-strong'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[1.05rem]">{option.title}</span>
                <span className="tabular text-xs text-ink-faint">{option.estimate}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{option.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void send(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed p-12 text-center transition-colors ${
          dragging ? 'border-brass bg-tint-brass' : 'border-rule-strong bg-case hover:border-brass'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void send(file)
          }}
        />
        <p className="font-display text-lg">
          {sending ? 'Enviando…' : 'Arraste um áudio ou toque para escolher'}
        </p>
        <p className="mt-2 text-sm text-ink-faint">MP3, WAV, FLAC, OGG, M4A</p>
      </div>

      {error && (
        <p className="rounded border border-felt bg-tint-felt px-4 py-3 text-sm text-ink-soft">
          {error}
        </p>
      )}
    </div>
  )
}
