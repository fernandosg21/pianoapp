import { useEffect, useMemo, useRef, useState } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow'

import { buildMeasures, type Measure } from '../lib/staff'
import type { Transcription } from '../types'

const MEASURES_PER_LINE = 4
const MEASURE_WIDTH = 260
const LINE_HEIGHT = 210
const PAGE_SIZE = 16

interface Props {
  transcription: Transcription
}

/**
 * Pauta dupla renderizada com VexFlow a partir da grade quantizada.
 *
 * É a saída mais frágil das três: empilha uma grade rítmica estimada sobre uma
 * transcrição que já é aproximada. Por isso o aviso fica visível no topo.
 */
export function Score({ transcription }: Props) {
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

    try {
      const lines = Math.ceil(shown.length / MEASURES_PER_LINE)
      const renderer = new Renderer(container, Renderer.Backends.SVG)
      renderer.resize(MEASURES_PER_LINE * MEASURE_WIDTH + 40, lines * LINE_HEIGHT + 40)
      const context = renderer.getContext()
      context.setFillStyle('#e6edf3')
      context.setStrokeStyle('#e6edf3')

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
  }, [shown, transcription.time_signature])

  if (measures.length === 0) {
    return <p className="text-slate-400">Nada para exibir na partitura.</p>
  }

  return (
    <div className="space-y-3">
      <p className="rounded border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
        Partitura <strong>aproximada</strong>: o ritmo é encaixado numa grade estimada por cima de
        uma transcrição automática. Serve para leitura, não como edição final.
      </p>
      {error && (
        <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          Não foi possível desenhar a pauta: {error}
        </p>
      )}
      <div ref={containerRef} className="overflow-x-auto rounded-lg bg-panel p-2" />
      {visible < measures.length && (
        <button
          className="rounded border border-edge px-3 py-1.5 text-sm hover:bg-panel"
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
