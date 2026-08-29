import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import { formatTime } from '../lib/notes'
import type { JobSummary } from '../types'

interface Props {
  onOpen: (jobId: string) => void
}

const STATE_LABEL: Record<JobSummary['state'], string> = {
  queued: 'na fila',
  running: 'processando',
  done: 'pronta',
  error: 'falhou',
}

/** Transcrições anteriores reabrem sem reprocessar — o SQLite guarda o resultado. */
export function Library({ onOpen }: Props) {
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    api.history()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const remove = async (id: string) => {
    await api.remove(id)
    refresh()
  }

  if (loading) return <p className="text-slate-400">Carregando…</p>
  if (jobs.length === 0) {
    return <p className="text-slate-400">Nenhuma transcrição ainda.</p>
  }

  return (
    <ul className="mx-auto max-w-3xl divide-y divide-edge overflow-hidden rounded-lg border border-edge bg-panel">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center gap-4 px-4 py-3">
          <button
            className="flex-1 text-left"
            onClick={() => job.state === 'done' && onOpen(job.id)}
            disabled={job.state !== 'done'}
          >
            <span className="block font-medium text-white">{job.filename}</span>
            <span className="text-xs text-slate-400">
              {new Date(job.created_at * 1000).toLocaleString('pt-BR')}
              {' · '}{job.mode === 'precise' ? 'máxima precisão' : 'rápido'}
              {job.route && ` · ${job.route === 'solo' ? 'solo' : 'mix denso'}`}
              {job.duration != null && ` · ${formatTime(job.duration)}`}
            </span>
          </button>
          <span
            className={`text-xs ${
              job.state === 'done' ? 'text-emerald-400'
              : job.state === 'error' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {STATE_LABEL[job.state]}
          </span>
          <button
            onClick={() => void remove(job.id)}
            className="rounded border border-edge px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
          >
            excluir
          </button>
        </li>
      ))}
    </ul>
  )
}
