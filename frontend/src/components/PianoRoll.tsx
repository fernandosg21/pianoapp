import { useEffect, useMemo, useRef, useState } from 'react'

import type { Theme } from '../hooks/useTheme'
import type { Loop } from '../hooks/usePlayback'
import { fullRange, keyFor, rangeForNotes, type KeyboardRange } from '../lib/keyboard'
import { octaveOf } from '../lib/notes'
import { readPalette, type Palette } from '../lib/palette'
import type { Note } from '../types'

const LOOKAHEAD_S = 4 // quanto do futuro cabe na tela
const FELT_HEIGHT = 9 // a tira de feltro sobre as teclas

interface Props {
  notes: Note[]
  timeRef: React.MutableRefObject<number>
  loop: Loop
  theme: Theme
  height: number
}

/**
 * O palco.
 *
 * Num piano vertical há uma tira de feltro carmim atravessada sobre as teclas.
 * Aqui ela é a linha do agora: acima dela está o que ainda vai soar, e no instante
 * em que uma nota cruza o feltro a tecla acende. É o único carmim da interface, e
 * é o ponto para onde o olho volta entre uma frase e outra.
 *
 * Canvas e não DOM de propósito: três minutos de música rendem milhares de notas, e
 * manter isso como elementos a 60 fps não se sustenta. A cada quadro desenhamos
 * apenas a janela visível.
 */
export function PianoRoll({ notes, timeRef, loop, theme, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [showAll88, setShowAll88] = useState(false)

  const autoRange = useMemo(() => rangeForNotes(notes.map((n) => n.midi)), [notes])
  const range = showAll88 ? fullRange() : autoRange

  // O loop de desenho lê destes refs, sem provocar re-render a 60 fps.
  const notesRef = useRef(notes)
  notesRef.current = notes
  const rangeRef = useRef<KeyboardRange>(range)
  rangeRef.current = range
  const loopRef = useRef(loop)
  loopRef.current = loop
  const paletteRef = useRef<Palette | null>(null)
  const paletteStaleRef = useRef(true)

  // Teclado mais baixo em telas curtas (iPad em paisagem tem pouca altura útil).
  const keyboardHeight = Math.round(Math.min(84, Math.max(52, height * 0.18)))

  // O canvas não enxerga variáveis CSS, e a releitura tem de acontecer dentro do
  // quadro de desenho, não aqui: efeitos de filho rodam antes dos do pai, então
  // neste ponto o data-theme do documento ainda é o anterior. Marcamos como velha
  // e o próximo requestAnimationFrame — já com o DOM atualizado — relê.
  useEffect(() => {
    paletteStaleRef.current = true
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(canvas.clientWidth * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      if (paletteStaleRef.current || paletteRef.current === null) {
        paletteRef.current = readPalette()
        paletteStaleRef.current = false
      }
      const palette = paletteRef.current
      const width = canvas.clientWidth
      const keyboardTop = height - keyboardHeight
      const feltTop = keyboardTop - FELT_HEIGHT
      const rollHeight = feltTop
      const now = timeRef.current
      const pxPerSecond = rollHeight / LOOKAHEAD_S
      const keyboard = rangeRef.current
      const timeToY = (t: number) => rollHeight - (t - now) * pxPerSecond

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = palette.stage
      ctx.fillRect(0, 0, width, height)

      // Linhas guia em cada dó — como as linhas de uma pauta: presentes, discretas.
      ctx.strokeStyle = palette.rule
      ctx.lineWidth = 1
      for (const key of keyboard.keys) {
        if (key.black || key.midi % 12 !== 0) continue
        const x = Math.round(key.x * width) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, rollHeight)
        ctx.stroke()
      }

      drawLoopRegion(ctx, loopRef.current, palette, width, rollHeight, timeToY)

      // Blocos caindo. Só o que está na janela visível.
      const active = new Set<number>()
      for (const note of notesRef.current) {
        if (note.end < now || note.start > now + LOOKAHEAD_S) continue

        const key = keyFor(keyboard, note.midi)
        if (!key) continue
        if (note.start <= now && note.end > now) active.add(note.midi)

        const top = Math.max(0, timeToY(note.end))
        const blockHeight = Math.max(3, Math.min(rollHeight, timeToY(note.start)) - top)

        ctx.fillStyle = note.hand === 'left' ? palette.handLeft : palette.handRight
        ctx.globalAlpha = 0.55 + 0.45 * note.velocity
        ctx.beginPath()
        ctx.roundRect(key.x * width + 1, top, Math.max(2, key.width * width - 2), blockHeight, 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      drawFelt(ctx, keyboard, palette, width, feltTop, active)
      drawKeyboard(ctx, keyboard, palette, width, keyboardTop, keyboardHeight, active)
      frame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
    }
  }, [height, keyboardHeight, timeRef])

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-md border border-rule"
        style={{ height }}
        aria-label="Piano roll das notas transcritas"
      />
      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <button
          onClick={() => setShowAll88((v) => !v)}
          className="control !min-h-[36px] !text-xs"
        >
          {showAll88 ? 'Ajustar à música' : 'Ver as 88 teclas'}
        </button>
        <span>
          {showAll88
            ? 'teclado completo, A0 a C8'
            : `oitavas ${octaveOf(range.first)} a ${octaveOf(range.last)}, que é o que a música usa`}
        </span>
      </div>
    </div>
  )
}

/** O trecho em repetição, visto de dentro do rolo: o tempo é o eixo vertical. */
function drawLoopRegion(
  ctx: CanvasRenderingContext2D,
  loop: Loop,
  palette: Palette,
  width: number,
  rollHeight: number,
  timeToY: (t: number) => number,
) {
  if (!loop.enabled || loop.a === null || loop.b === null) return

  const top = Math.max(0, timeToY(loop.b))
  const bottom = Math.min(rollHeight, timeToY(loop.a))
  if (bottom <= 0 || top >= rollHeight) return

  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = palette.feltGlow
  ctx.fillRect(0, top, width, bottom - top)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = palette.feltGlow
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  for (const [time, y] of [[loop.a, bottom], [loop.b, top]] as const) {
    if (time === null || y <= 0 || y >= rollHeight) continue
    ctx.beginPath()
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(width, Math.round(y) + 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

/** A assinatura: a tira de feltro. Acende sob as notas que estão soando agora. */
function drawFelt(
  ctx: CanvasRenderingContext2D,
  keyboard: KeyboardRange,
  palette: Palette,
  width: number,
  top: number,
  active: Set<number>,
) {
  ctx.fillStyle = palette.felt
  ctx.fillRect(0, top, width, FELT_HEIGHT)

  for (const midi of active) {
    const key = keyFor(keyboard, midi)
    if (!key) continue
    ctx.fillStyle = palette.feltGlow
    ctx.fillRect(key.x * width, top, key.width * width, FELT_HEIGHT)
  }
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  keyboard: KeyboardRange,
  palette: Palette,
  width: number,
  top: number,
  keyboardHeight: number,
  active: Set<number>,
) {
  ctx.fillStyle = palette.sharp
  ctx.fillRect(0, top, width, keyboardHeight)

  const whiteWidthPx = width / keyboard.whiteCount
  const labelOctaves = whiteWidthPx > 24 // só rotula quando há espaço de fato

  for (const key of keyboard.keys) {
    if (key.black) continue
    const x = key.x * width
    const w = key.width * width
    ctx.fillStyle = active.has(key.midi) ? palette.naturalLit : palette.natural
    ctx.fillRect(x + 0.5, top, w - 1, keyboardHeight)

    if (labelOctaves && key.midi % 12 === 0) {
      ctx.fillStyle = palette.inkFaint
      ctx.font = "10px 'IBM Plex Mono', ui-monospace, monospace"
      ctx.textAlign = 'center'
      ctx.fillText(`C${octaveOf(key.midi)}`, x + w / 2, top + keyboardHeight - 7)
    }
  }

  // Pretas por cima, mais curtas.
  for (const key of keyboard.keys) {
    if (!key.black) continue
    ctx.fillStyle = active.has(key.midi) ? palette.sharpLit : palette.sharp
    ctx.fillRect(key.x * width, top, key.width * width, keyboardHeight * 0.6)
  }
}
