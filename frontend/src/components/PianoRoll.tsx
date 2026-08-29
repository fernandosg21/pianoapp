import { useEffect, useRef } from 'react'

import { allKeys, keyFor } from '../lib/keyboard'
import type { Note } from '../types'

const KEYBOARD_HEIGHT = 88
const LOOKAHEAD_S = 4 // quanto do futuro cabe na tela
const RIGHT_COLOR = '#4ea8de'
const LEFT_COLOR = '#f4a261'

interface Props {
  notes: Note[]
  timeRef: React.MutableRefObject<number>
  height?: number
}

/**
 * Piano roll estilo Synthesia, em canvas.
 *
 * Canvas e não DOM de propósito: três minutos de música rendem milhares de notas, e
 * manter isso como elementos a 60 fps não se sustenta. A cada quadro desenhamos
 * apenas a janela visível.
 */
export function PianoRoll({ notes, timeRef, height = 460 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      const width = canvas.clientWidth
      const rollHeight = height - KEYBOARD_HEIGHT
      const now = timeRef.current
      const pxPerSecond = rollHeight / LOOKAHEAD_S

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, width, height)

      // Linhas guia nas oitavas, para dar referência de altura.
      ctx.strokeStyle = '#1c2430'
      ctx.lineWidth = 1
      for (const key of allKeys()) {
        if (key.black || key.midi % 12 !== 0) continue
        const x = Math.round(key.x * width) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, rollHeight)
        ctx.stroke()
      }

      // Blocos caindo. Só o que está na janela visível.
      const active = new Set<number>()
      for (const note of notesRef.current) {
        if (note.end < now) continue
        if (note.start > now + LOOKAHEAD_S) continue

        const key = keyFor(note.midi)
        if (!key) continue
        if (note.start <= now && note.end > now) active.add(note.midi)

        const yEnd = rollHeight - (note.start - now) * pxPerSecond
        const yStart = rollHeight - (note.end - now) * pxPerSecond
        const top = Math.max(0, yStart)
        const blockHeight = Math.max(3, Math.min(rollHeight, yEnd) - top)

        ctx.fillStyle = note.hand === 'left' ? LEFT_COLOR : RIGHT_COLOR
        ctx.globalAlpha = 0.55 + 0.45 * note.velocity
        const x = key.x * width + 1
        const w = Math.max(2, key.width * width - 2)
        ctx.beginPath()
        ctx.roundRect(x, top, w, blockHeight, 3)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      drawKeyboard(ctx, width, rollHeight, active)
      frame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [height, timeRef])

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-edge"
      style={{ height }}
      aria-label="Piano roll das notas transcritas"
    />
  )
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  active: Set<number>,
) {
  ctx.fillStyle = '#0a0d12'
  ctx.fillRect(0, top, width, KEYBOARD_HEIGHT)

  for (const key of allKeys()) {
    if (key.black) continue
    const x = key.x * width
    const w = key.width * width
    ctx.fillStyle = active.has(key.midi) ? '#8ecae6' : '#e8ecf1'
    ctx.fillRect(x + 0.5, top + 2, w - 1, KEYBOARD_HEIGHT - 4)
    ctx.strokeStyle = '#0a0d12'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, top + 2, w - 1, KEYBOARD_HEIGHT - 4)
  }

  // Pretas por cima, mais curtas.
  for (const key of allKeys()) {
    if (!key.black) continue
    const x = key.x * width
    const w = key.width * width
    ctx.fillStyle = active.has(key.midi) ? '#4ea8de' : '#171c24'
    ctx.fillRect(x, top + 2, w, KEYBOARD_HEIGHT * 0.62)
  }
}
