// Geometria de um teclado de 88 teclas (A0 = MIDI 21 até C8 = MIDI 108).
// Usada tanto pelo desenho do teclado quanto pelo posicionamento dos blocos.

import { isBlackKey } from './notes'

export const FIRST_MIDI = 21
export const LAST_MIDI = 108
export const WHITE_KEY_COUNT = 52
const BLACK_WIDTH_RATIO = 0.62

export interface KeyGeometry {
  midi: number
  black: boolean
  /** Posição e largura em frações da largura total (0-1), para escalar em qualquer canvas. */
  x: number
  width: number
}

function buildGeometry(): KeyGeometry[] {
  const whiteWidth = 1 / WHITE_KEY_COUNT
  const blackWidth = whiteWidth * BLACK_WIDTH_RATIO
  const keys: KeyGeometry[] = []
  let whiteIndex = 0

  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (isBlackKey(midi)) {
      // A tecla preta se apoia na fronteira entre a branca anterior e a próxima.
      keys.push({ midi, black: true, x: whiteIndex * whiteWidth - blackWidth / 2, width: blackWidth })
    } else {
      keys.push({ midi, black: false, x: whiteIndex * whiteWidth, width: whiteWidth })
      whiteIndex++
    }
  }
  return keys
}

const GEOMETRY = buildGeometry()
const BY_MIDI = new Map(GEOMETRY.map((k) => [k.midi, k]))

export function allKeys(): KeyGeometry[] {
  return GEOMETRY
}

export function keyFor(midi: number): KeyGeometry | undefined {
  return BY_MIDI.get(midi)
}
