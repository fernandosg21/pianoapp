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
  done: '',
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

  if (loading) return <p className="text-ink-faint">Carregando…</p>
  if (jobs.length === 0) {
    return (
      <p className="mx-auto max-w-3xl text-ink-faint">
        Nada estudado ainda. A primeira transcrição aparece aqui.
      </p>
    )
  }

  return (
    <ul className="surface mx-auto max-w-3xl divide-y divide-rule overflow-hidden">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center gap-4 px-4">
          <button
            className="flex-1 py-3 text-left disabled:opacity-60"
            onClick={() => job.state === 'done' && onOpen(job.id)}
            disabled={job.state !== 'done'}
          >
            <span className="font-display block text-[1.05rem]">{job.filename}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-faint">
              <span className="tabular">
                {new Date(job.created_at * 1000).toLocaleString('pt-BR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span>{job.mode === 'precise' ? 'máxima precisão' : 'rápido'}</span>
              {job.route && <span>{job.route === 'solo' ? 'solo' : 'mix denso'}</span>}
              {job.duration != null && <span className="tabular">{formatTime(job.duration)}</span>}
              {STATE_LABEL[job.state] && (
                <span className={job.state === 'error' ? 'text-felt' : 'text-brass'}>
                  {STATE_LABEL[job.state]}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => void remove(job.id)}
            className="text-xs text-ink-faint hover:text-felt"
            aria-label={`Excluir ${job.filename}`}
          >
            excluir
          </button>
        </li>
      ))}
    </ul>
  )
}
