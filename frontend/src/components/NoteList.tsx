import { useEffect, useMemo, useRef, useState } from 'react'

import { formatTime, fullName, octaveOf, pitchName, type Notation } from '../lib/notes'
import type { Note } from '../types'

const ROW_HEIGHT = 34
const OVERSCAN = 12

interface Props {
  notes: Note[]
  notation: Notation
  currentTime: number
  onSeek: (seconds: number) => void
}

/**
 * As notas como texto, para ler e anotar.
 *
 * Virtualizada: uma faixa de três minutos rende milhares de linhas, e renderizar
 * todas trava a rolagem. A nota que soa agora recebe a marca de feltro na borda —
 * a mesma linha do agora do teclado, aqui deitada.
 */
export function NoteList({ notes, notation, currentTime, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(420)
  const [follow, setFollow] = useState(true)
  const [copied, setCopied] = useState(false)

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
    viewport.scrollTo({
      top: Math.max(0, currentIndex * ROW_HEIGHT - viewport.clientHeight / 2),
      behavior: 'smooth',
    })
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
  const last = Math.min(
    notes.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
  )

  const copyAll = () => {
    const text = notes
      .map((n) => `${formatTime(n.start)}\t${fullName(n.midi, notation)}\t${n.hand === 'left' ? 'E' : 'D'}`)
      .join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button onClick={() => setFollow((v) => !v)} className="control" aria-pressed={follow}>
          Acompanhar
        </button>
        <button onClick={copyAll} className="control">
          {copied ? 'copiado' : `Copiar ${notes.length} notas`}
        </button>
        <span className="ml-auto flex items-center gap-3 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hand-right" /> direita
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hand-left" /> esquerda
          </span>
        </span>
      </div>

      <div
        ref={viewportRef}
        className="surface h-[420px] overflow-y-auto"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: notes.length * ROW_HEIGHT, position: 'relative' }}>
          {notes.slice(first, last).map((note, i) => {
            const index = first + i
            const active = index === currentIndex
            return (
              <button
                key={index}
                onClick={() => onSeek(note.start)}
                className={`absolute flex w-full items-center gap-4 border-l-2 px-4 text-left transition-colors ${
                  active
                    ? 'border-felt bg-tint-felt text-ink'
                    : 'border-transparent hover:bg-tint-ink'
                }`}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <span className="tabular w-14 text-xs text-ink-faint">
                  {formatTime(note.start)}
                </span>
                <span
                  className="font-display w-24 text-[0.95rem]"
                  style={{
                    color: note.hand === 'left' ? 'var(--hand-left)' : 'var(--hand-right)',
                  }}
                >
                  {pitchName(note.midi, notation)}
                  <span className="tabular text-xs text-ink-faint">{octaveOf(note.midi)}</span>
                </span>
                <span className="tabular w-20 text-xs text-ink-faint">
                  {(note.end - note.start).toFixed(2)}s
                </span>
                {/* A dinâmica como barra: ler "0.82" não diz nada; ver a força, sim. */}
                <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-rule sm:block">
                  <span
                    className="block h-full rounded-full bg-current opacity-60"
                    style={{
                      width: `${Math.round(note.velocity * 100)}%`,
                      color: note.hand === 'left' ? 'var(--hand-left)' : 'var(--hand-right)',
                    }}
                  />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
