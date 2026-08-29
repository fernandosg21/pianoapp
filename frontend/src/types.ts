// Espelha backend/app/schemas.py. Manter os dois lados em sincronia.

export type Mode = 'fast' | 'precise'
export type Route = 'solo' | 'dense_mix'
export type Hand = 'left' | 'right'
export type JobState = 'queued' | 'running' | 'done' | 'error'
export type Stage =
  | 'queued' | 'loading' | 'triage' | 'separation' | 'transcription' | 'score' | 'done'

export interface Note {
  midi: number
  name: string
  octave: number
  start: number
  end: number
  velocity: number
  hand: Hand
  start_beat: number
  dur_beats: number
}

export interface PedalEvent {
  start: number
  end: number
}

export interface Transcription {
  duration: number
  tempo: number
  time_signature: [number, number]
  route: Route
  mode: Mode
  device: string
  notes: Note[]
  pedal: PedalEvent[]
}

export interface JobStatus {
  id: string
  filename: string
  state: JobState
  stage: Stage
  progress: number
  queue_position: number | null
  mode: Mode
  route: Route | null
  device: string | null
  error: string | null
  created_at: number
}

export interface JobSummary {
  id: string
  filename: string
  state: JobState
  mode: Mode
  route: Route | null
  created_at: number
  duration: number | null
}

export interface Health {
  status: string
  device: string
  gpu: boolean
  gpu_name: string | null
  vram_total_mb: number | null
  vram_free_mb: number | null
  models_loaded: string[]
}
