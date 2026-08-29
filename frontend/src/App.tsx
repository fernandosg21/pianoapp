import { useState } from 'react'

import { HealthBar } from './components/HealthBar'
import { Library } from './components/Library'
import { Progress } from './components/Progress'
import { Result } from './components/Result'
import { Upload } from './components/Upload'
import { useTranscriptionJob } from './hooks/useTranscriptionJob'
import { api } from './lib/api'
import type { Route } from './types'

type View = 'upload' | 'library'

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [view, setView] = useState<View>('upload')
  const { status, result, error } = useTranscriptionJob(jobId)

  const reprocess = async (force: Route) => {
    if (!jobId) return
    const { job_id } = await api.reprocess(jobId, 'precise', force)
    setJobId(job_id)
  }

  const reset = () => {
    setJobId(null)
    setView('upload')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <button onClick={reset} className="text-lg font-semibold text-white">
            pianoapp
          </button>
          <nav className="flex gap-1 text-sm">
            <button
              onClick={reset}
              className={`rounded px-3 py-1 ${view === 'upload' && !jobId ? 'bg-panel text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Nova transcrição
            </button>
            <button
              onClick={() => { setJobId(null); setView('library') }}
              className={`rounded px-3 py-1 ${view === 'library' ? 'bg-panel text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Minhas transcrições
            </button>
          </nav>
          <div className="ml-auto">
            <HealthBar />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mx-auto mb-6 max-w-xl rounded border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
            <p>{error}</p>
            <button onClick={reset} className="mt-2 underline">
              Tentar outro arquivo
            </button>
          </div>
        )}

        {!jobId && view === 'upload' && (
          <Upload onStarted={(id) => { setJobId(id); setView('upload') }} />
        )}
        {!jobId && view === 'library' && <Library onOpen={setJobId} />}
        {jobId && !result && status && !error && <Progress status={status} />}
        {jobId && result && (
          <Result jobId={jobId} transcription={result} onReprocess={reprocess} />
        )}
      </main>
    </div>
  )
}
