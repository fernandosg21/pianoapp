import { useEffect, useMemo, useRef, useState } from 'react'

import { formatTime, fullName, type Notation } from '../lib/notes'
import type { Note } from '../types'

const ROW_HEIGHT = 30
const OVERSCAN = 12

interface Props {
  notes: Note[]
  notation: Notation
  currentTime: number
  onSeek: (seconds: number) => void
}

/**
 * Lista das notas, virtualizada.
 *
 * Uma faixa de três minutos rende milhares de linhas; renderizar todas trava a
 * rolagem, então só as visíveis vão ao DOM.
 */
export function NoteList({ notes, notation, currentTime, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(420)
  const [follow, setFollow] = useState(true)

  const currentIndex = useMemo(() => {
    let index = -1
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].start <= currentTime) index = i
      else break
    }
    return index
  }, [notes, currentTime])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !follow || currentIndex < 0) return
    const target = currentIndex * ROW_HEIGHT - viewport.clientHeight / 2
    viewport.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [currentIndex, follow])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const update = () => setViewportHeight(viewport.clientHeight)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(notes.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const slice = notes.slice(first, last)

  const copyAll = () => {
    const text = notes
      .map((n) => `${formatTime(n.start)}\t${fullName(n.midi, notation)}\t${n.hand === 'left' ? 'E' : 'D'}`)
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Acompanhar reprodução
        </label>
        <button className="rounded border border-edge px-2 py-1 hover:bg-panel" onClick={copyAll}>
          Copiar todas ({notes.length})
        </button>
      </div>

      <div
        ref={viewportRef}
        className="h-[420px] overflow-y-auto rounded-lg border border-edge bg-panel"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: notes.length * ROW_HEIGHT, position: 'relative' }}>
          {slice.map((note, i) => {
            const index = first + i
            const active = index === currentIndex
            return (
              <button
                key={index}
                onClick={() => onSeek(note.start)}
                className={`absolute flex w-full items-center gap-4 px-4 text-left text-sm ${
                  active ? 'bg-sky-900/50 text-white' : 'hover:bg-white/5'
                }`}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <span className="w-14 tabular-nums text-slate-400">{formatTime(note.start)}</span>
                <span
                  className={`w-20 font-medium ${
                    note.hand === 'left' ? 'text-left-hand' : 'text-right-hand'
                  }`}
                  style={{ color: note.hand === 'left' ? '#f4a261' : '#4ea8de' }}
                >
                  {fullName(note.midi, notation)}
                </span>
                <span className="w-24 text-slate-400">
                  {(note.end - note.start).toFixed(2)} s
                </span>
                <span className="text-slate-500">{note.hand === 'left' ? 'esquerda' : 'direita'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
