import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../lib/api'
import type { JobStatus, Transcription } from '../types'

const POLL_MS = 1000

/** Acompanha um job até o fim e busca o resultado. */
export function useTranscriptionJob(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [result, setResult] = useState<Transcription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => {
    setStatus(null)
    setResult(null)
    setError(null)
    stop()
    if (!jobId) return

    const poll = async () => {
      try {
        const next = await api.status(jobId)
        setStatus(next)
        if (next.state === 'done') {
          stop()
          setResult(await api.result(jobId))
        } else if (next.state === 'error') {
          stop()
          setError(next.error ?? 'A transcrição falhou.')
        }
      } catch (err) {
        stop()
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void poll()
    timer.current = window.setInterval(poll, POLL_MS)
    return stop
  }, [jobId, stop])

  return { status, result, error }
}
