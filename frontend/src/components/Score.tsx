import { useEffect, useMemo, useRef, useState } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow'

import type { Theme } from '../hooks/useTheme'
import { buildMeasures, type Measure } from '../lib/staff'
import type { Transcription } from '../types'

const MEASURES_PER_LINE = 4
const MEASURE_WIDTH = 260
const LINE_HEIGHT = 210
const PAGE_SIZE = 16

interface Props {
  transcription: Transcription
  theme: Theme
}

/**
 * Pauta dupla renderizada com VexFlow a partir da grade quantizada.
 *
 * É a saída mais frágil das três: empilha uma grade rítmica estimada sobre uma
 * transcrição que já é aproximada. Por isso o aviso fica visível no topo.
 */
export function Score({ transcription, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)

  const measures = useMemo(
    () => buildMeasures(transcription.notes, transcription.time_signature[0]),
    [transcription],
  )
  const shown = measures.slice(0, visible)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''
    if (shown.length === 0) return

    // Mesmo motivo do piano roll: neste ponto o data-theme ainda é o anterior,
    // porque efeitos de filho rodam antes dos do pai. Desenhamos no quadro seguinte.
    const frame = requestAnimationFrame(() => {
    try {
      const lines = Math.ceil(shown.length / MEASURES_PER_LINE)
      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(MEASURES_PER_LINE * MEASURE_WIDTH + 40, lines * LINE_HEIGHT + 40)
      const context = renderer.getContext()
      // A pauta é tinta sobre o papel do tema, não uma cor fixa.
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
      context.setFillStyle(ink)
      context.setStrokeStyle(ink)

      shown.forEach((measure, i) => {
        const column = i % MEASURES_PER_LINE
        const line = Math.floor(i / MEASURES_PER_LINE)
        const x = 20 + column * MEASURE_WIDTH
        const y = 20 + line * LINE_HEIGHT
        drawMeasure(context, measure, x, y, column === 0, transcription.time_signature)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    })
    return () => cancelAnimationFrame(frame)
  }, [shown, transcription.time_signature, theme])

  if (measures.length === 0) {
    return <p className="text-ink-faint">Nada para exibir na partitura.</p>
  }

  return (
    <div className="space-y-3">
      <p className="rounded border border-brass bg-tint-brass px-3 py-2 text-sm text-ink-soft">
        Partitura <strong>aproximada</strong>: o ritmo é encaixado numa grade estimada por cima de
        uma transcrição automática. Serve para leitura, não como edição final.
      </p>
      {error && (
        <p className="rounded border border-felt bg-tint-felt px-3 py-2 text-sm text-ink-soft">
          Não foi possível desenhar a pauta: {error}
        </p>
      )}
      <div ref={containerRef} className="surface overflow-x-auto p-2" />
      {visible < measures.length && (
        <button
          className="control"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          Mostrar mais compassos ({measures.length - visible} restantes)
        </button>
      )}
    </div>
  )
}

function toStaveNotes(measure: Measure, clef: 'treble' | 'bass'): StaveNote[] {
  const events = clef === 'treble' ? measure.treble : measure.bass
  return events.map((event) => {
    const isRest = event.keys.length === 0
    const note = new StaveNote({
      clef,
      keys: isRest ? [clef === 'treble' ? 'b/4' : 'd/3'] : event.keys,
      duration: event.duration,
    })
    if (!isRest) {
      event.keys.forEach((key, index) => {
        if (key.includes('#')) note.addModifier(new Accidental('#'), index)
      })
    }
    return note
  })
}

function drawMeasure(
  context: ReturnType<Renderer['getContext']>,
  measure: Measure,
  x: number,
  y: number,
  withClef: boolean,
  timeSignature: [number, number],
) {
  const treble = new Stave(x, y, MEASURE_WIDTH)
  const bass = new Stave(x, y + 90, MEASURE_WIDTH)

  if (withClef) {
    treble.addClef('treble').addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`)
    bass.addClef('bass').addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`)
  }
  treble.setContext(context).draw()
  bass.setContext(context).draw()

  if (withClef) {
    new StaveConnector(treble, bass).setType(StaveConnector.type.BRACE).setContext(context).draw()
  }
  new StaveConnector(treble, bass).setType(StaveConnector.type.SINGLE_LEFT)
    .setContext(context).draw()

  for (const [stave, clef] of [[treble, 'treble'], [bass, 'bass']] as const) {
    const notes = toStaveNotes(measure, clef)
    if (notes.length === 0) continue
    const voice = new Voice({ num_beats: timeSignature[0], beat_value: timeSignature[1] })
    // Modo tolerante de propósito: dados aproximados nem sempre somam o compasso
    // exato, e uma pauta levemente frouxa é melhor que uma exceção na tela.
    voice.setStrict(false)
    voice.addTickables(notes)
    new Formatter().joinVoices([voice]).format([voice], MEASURE_WIDTH - 40)
    voice.draw(context, stave)
  }
}
