import type { Health, JobStatus, JobSummary, Mode, Route, Transcription } from '../types'

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `Erro ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => fetch('/api/health').then(json<Health>),

  transcribe(file: File, mode: Mode, forceRoute?: Route) {
    const body = new FormData()
    body.append('file', file)
    body.append('mode', mode)
    if (forceRoute) body.append('force_route', forceRoute)
    return fetch('/api/transcribe', { method: 'POST', body }).then(json<{ job_id: string }>)
  },

  /** Reaproveita o áudio já enviado, forçando a outra rota. */
  reprocess(id: string, mode: Mode, forceRoute?: Route) {
    const body = new FormData()
    body.append('mode', mode)
    if (forceRoute) body.append('force_route', forceRoute)
    return fetch(`/api/jobs/${id}/reprocess`, { method: 'POST', body })
      .then(json<{ job_id: string }>)
  },

  status: (id: string) => fetch(`/api/jobs/${id}`).then(json<JobStatus>),
  result: (id: string) => fetch(`/api/jobs/${id}/result`).then(json<Transcription>),
  history: () => fetch('/api/jobs').then(json<JobSummary[]>),
  remove: (id: string) => fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(json<unknown>),

  audioUrl: (id: string) => `/api/jobs/${id}/audio`,
  midiUrl: (id: string) => `/api/jobs/${id}/midi`,
}
