// Converte as notas quantizadas em compassos prontos para o VexFlow.
//
// A fonte é uma transcrição aproximada, então esta camada é deliberadamente
// tolerante: prefere desenhar algo levemente frouxo a recusar-se a desenhar.

import type { Note } from '../types'

export interface StaffEvent {
  /** Vazio significa pausa. */
  keys: string[]
  duration: string
  beatsFromMeasureStart: number
}

export interface Measure {
  index: number
  treble: StaffEvent[]
  bass: StaffEvent[]
}

const LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

// Durações que o VexFlow entende, da mais longa para a mais curta.
const DURATIONS: Array<[number, string]> = [
  [4, 'w'],
  [3, 'hd'],
  [2, 'h'],
  [1.5, 'qd'],
  [1, 'q'],
  [0.75, '8d'],
  [0.5, '8'],
  [0.25, '16'],
]

export function vexKey(midi: number): string {
  const pitch = LETTERS[((midi % 12) + 12) % 12]
  return `${pitch}/${Math.floor(midi / 12) - 1}`
}

/** Aproxima uma duração em batidas para o valor rítmico mais próximo. */
export function durationCode(beats: number): string {
  let best = DURATIONS[DURATIONS.length - 1]
  let bestDiff = Infinity
  for (const candidate of DURATIONS) {
    const diff = Math.abs(candidate[0] - beats)
    if (diff < bestDiff) {
      bestDiff = diff
      best = candidate
    }
  }
  return best[1]
}

function buildHand(notes: Note[], measureStart: number, beatsPerMeasure: number): StaffEvent[] {
  const inMeasure = notes.filter(
    (n) => n.start_beat >= measureStart && n.start_beat < measureStart + beatsPerMeasure,
  )
  if (inMeasure.length === 0) {
    return [{ keys: [], duration: 'wr', beatsFromMeasureStart: 0 }]
  }

  // Notas que começam juntas viram um acorde.
  const byOnset = new Map<number, Note[]>()
  for (const note of inMeasure) {
    const onset = Math.round((note.start_beat - measureStart) * 4) / 4
    const group = byOnset.get(onset)
    if (group) group.push(note)
    else byOnset.set(onset, [note])
  }

  const onsets = [...byOnset.keys()].sort((a, b) => a - b)
  const events: StaffEvent[] = []
  let cursor = 0

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i]
    if (onset > cursor + 0.01) {
      events.push({
        keys: [],
        duration: `${durationCode(onset - cursor)}r`,
        beatsFromMeasureStart: cursor,
      })
    }
    const chord = byOnset.get(onset)!
    const next = i + 1 < onsets.length ? onsets[i + 1] : beatsPerMeasure
    // A nota não pode invadir o próximo ataque nem transbordar o compasso.
    const span = Math.min(Math.max(...chord.map((n) => n.dur_beats)), next - onset)
    events.push({
      keys: chord.map((n) => vexKey(n.midi)).sort(),
      duration: durationCode(Math.max(0.25, span)),
      beatsFromMeasureStart: onset,
    })
    cursor = onset + Math.max(0.25, span)
  }

  return events
}

export function buildMeasures(notes: Note[], beatsPerMeasure = 4, maxMeasures = 64): Measure[] {
  if (notes.length === 0) return []

  const lastBeat = Math.max(...notes.map((n) => n.start_beat + n.dur_beats))
  const total = Math.min(maxMeasures, Math.max(1, Math.ceil(lastBeat / beatsPerMeasure)))
  const right = notes.filter((n) => n.hand === 'right')
  const left = notes.filter((n) => n.hand === 'left')

  const measures: Measure[] = []
  for (let i = 0; i < total; i++) {
    const start = i * beatsPerMeasure
    measures.push({
      index: i,
      treble: buildHand(right, start, beatsPerMeasure),
      bass: buildHand(left, start, beatsPerMeasure),
    })
  }
  return measures
}
