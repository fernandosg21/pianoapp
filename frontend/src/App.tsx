import { useState } from 'react'

import { HealthBar } from './components/HealthBar'
import { Library } from './components/Library'
import { Progress } from './components/Progress'
import { Result } from './components/Result'
import { Upload } from './components/Upload'
import { useTheme } from './hooks/useTheme'
import { useTranscriptionJob } from './hooks/useTranscriptionJob'
import { api } from './lib/api'
import type { Route } from './types'

type View = 'upload' | 'library'

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [view, setView] = useState<View>('upload')
  const { status, result, error } = useTranscriptionJob(jobId)
  const { theme, toggle: toggleTheme } = useTheme()

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
      {/* A tira de feltro atravessa o topo, como no piano vertical. */}
      <div className="h-[3px] bg-felt" />

      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-6">
          <button onClick={reset} className="font-display text-lg tracking-tight">
            pianoapp
          </button>

          <nav className="flex gap-4 text-sm">
            <button
              onClick={reset}
              className={
                view === 'upload' && !jobId ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
              }
            >
              Nova
            </button>
            <button
              onClick={() => {
                setJobId(null)
                setView('library')
              }}
              className={view === 'library' ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'}
            >
              Estudadas
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <HealthBar />
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded text-ink-faint hover:text-ink-soft"
              aria-label={theme === 'night' ? 'Mudar para papel' : 'Mudar para sala escura'}
              title={theme === 'night' ? 'Partitura em papel' : 'Sala de piano, à noite'}
            >
              {theme === 'night' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        {error && (
          <div className="mx-auto mb-6 max-w-xl rounded border border-felt bg-tint-felt px-4 py-3 text-sm">
            <p className="text-ink-soft">{error}</p>
            <button onClick={reset} className="mt-2 text-ink-faint underline underline-offset-4">
              tentar outro arquivo
            </button>
          </div>
        )}

        {!jobId && view === 'upload' && (
          <Upload
            onStarted={(id) => {
              setJobId(id)
              setView('upload')
            }}
          />
        )}
        {!jobId && view === 'library' && <Library onOpen={setJobId} />}
        {jobId && !result && status && !error && <Progress status={status} />}
        {jobId && result && (
          <Result
            jobId={jobId}
            transcription={result}
            theme={theme}
            onReprocess={reprocess}
          />
        )}
      </main>
    </div>
  )
}
