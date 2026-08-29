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
    estimate: '~1 a 5 min',
  },
  {
    value: 'fast',
    title: 'Rápido',
    detail: 'Um único passe multi-instrumento, sem separação de fontes. Bom para uma prévia.',
    estimate: '~10 a 30 s',
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Escolha a qualidade</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={`rounded-lg border p-4 text-left transition ${
                mode === option.value
                  ? 'border-sky-500 bg-sky-950/40'
                  : 'border-edge bg-panel hover:border-slate-500'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-white">{option.title}</span>
                <span className="text-xs text-slate-400">{option.estimate}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{option.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void send(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragging ? 'border-sky-400 bg-sky-950/30' : 'border-edge bg-panel hover:border-slate-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void send(file)
          }}
        />
        <p className="text-lg text-white">
          {sending ? 'Enviando…' : 'Arraste um áudio aqui ou clique para escolher'}
        </p>
        <p className="mt-2 text-sm text-slate-400">MP3, WAV, FLAC, OGG, M4A</p>
      </div>

      {error && (
        <p className="rounded border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  )
}
