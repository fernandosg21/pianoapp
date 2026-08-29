// Nomes de nota. O padrão brasileiro é Dó-Ré-Mi, mas cifra usa C-D-E — a UI alterna.

export type Notation = 'letters' | 'solfege'

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SOLFEGE = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si']

export function pitchName(midi: number, notation: Notation): string {
  const table = notation === 'solfege' ? SOLFEGE : LETTERS
  return table[((midi % 12) + 12) % 12]
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export function fullName(midi: number, notation: Notation): string {
  return `${pitchName(midi, notation)}${octaveOf(midi)}`
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
