// Geometria de teclado de piano, para uma faixa arbitrária de alturas.
//
// Mostrar as 88 teclas sempre é desperdício: numa tela de iPad cada tecla branca
// fica com ~15 px e as notas viram fiapos. Quase toda música ocupa três ou quatro
// oitavas, então o teclado se ajusta ao que a peça realmente usa.

import { isBlackKey } from './notes'

export const FIRST_MIDI = 21 // A0
export const LAST_MIDI = 108 // C8
const BLACK_WIDTH_RATIO = 0.62
const MIN_SPAN_SEMITONES = 24 // nunca menos que duas oitavas, para não ficar bizarro

export interface KeyGeometry {
  midi: number
  black: boolean
  /** Posição e largura em frações da largura total (0-1), escaláveis a qualquer canvas. */
  x: number
  width: number
}

export interface KeyboardRange {
  first: number
  last: number
  keys: KeyGeometry[]
  whiteCount: number
}

function countWhite(first: number, last: number): number {
  let total = 0
  for (let midi = first; midi <= last; midi++) if (!isBlackKey(midi)) total++
  return total
}

const cache = new Map<string, KeyboardRange>()

export function buildRange(first: number, last: number): KeyboardRange {
  const key = `${first}:${last}`
  const cached = cache.get(key)
  if (cached) return cached

  const whiteCount = countWhite(first, last)
  const whiteWidth = 1 / whiteCount
  const blackWidth = whiteWidth * BLACK_WIDTH_RATIO
  const keys: KeyGeometry[] = []
  let whiteIndex = 0

  for (let midi = first; midi <= last; midi++) {
    if (isBlackKey(midi)) {
      // A tecla preta se apoia na fronteira entre a branca anterior e a próxima.
      keys.push({
        midi,
        black: true,
        x: whiteIndex * whiteWidth - blackWidth / 2,
        width: blackWidth,
      })
    } else {
      keys.push({ midi, black: false, x: whiteIndex * whiteWidth, width: whiteWidth })
      whiteIndex++
    }
  }

  const range: KeyboardRange = { first, last, keys, whiteCount }
  cache.set(key, range)
  return range
}

/** O teclado inteiro de 88 teclas. */
export function fullRange(): KeyboardRange {
  return buildRange(FIRST_MIDI, LAST_MIDI)
}

/**
 * Faixa que cobre as notas da peça, alinhada a oitavas inteiras.
 *
 * Alinhar em dó mantém o teclado com aparência correta (começa e termina em tecla
 * branca) e dá ao olho uma referência estável de oitava.
 */
export function rangeForNotes(midis: number[]): KeyboardRange {
  if (midis.length === 0) return fullRange()

  let low = Math.min(...midis)
  let high = Math.max(...midis)

  // Desce até o dó abaixo e sobe até o si acima.
  low = Math.max(FIRST_MIDI, Math.floor(low / 12) * 12)
  high = Math.min(LAST_MIDI, Math.floor(high / 12) * 12 + 11)

  // Alarga simetricamente, em oitavas, até o mínimo aceitável.
  while (high - low + 1 < MIN_SPAN_SEMITONES) {
    if (low - 12 >= FIRST_MIDI) low -= 12
    else if (high + 12 <= LAST_MIDI) high += 12
    else break
  }

  return buildRange(low, high)
}

export function keyFor(range: KeyboardRange, midi: number): KeyGeometry | undefined {
  if (midi < range.first || midi > range.last) return undefined
  return range.keys[midi - range.first]
}
