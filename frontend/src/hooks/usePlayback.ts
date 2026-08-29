import { useCallback, useEffect, useRef, useState } from 'react'

export interface Loop {
  a: number | null
  b: number | null
  enabled: boolean
}

const EMPTY_LOOP: Loop = { a: null, b: null, enabled: false }

/**
 * Relógio único do app, com laço de repetição.
 *
 * O elemento <audio> é a fonte de verdade do tempo — nada de timer paralelo, que é
 * o que faria o piano roll sair de sincronia com o som depois de alguns minutos.
 *
 * O tempo vive num ref atualizado a cada quadro (o canvas lê dali, sem provocar
 * render) e num state atualizado poucas vezes por segundo, só para os textos.
 *
 * O laço A-B mora aqui e não numa camada acima porque estudar é repetir dois
 * compassos até a mão aprender: é o gesto mais usado, e precisa acontecer dentro
 * do mesmo quadro em que o tempo é lido, sem atraso audível na volta.
 */
export function usePlayback(src: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timeRef = useRef(0)
  const loopRef = useRef<Loop>(EMPTY_LOOP)

  const [displayTime, setDisplayTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [loop, setLoop] = useState<Loop>(EMPTY_LOOP)

  loopRef.current = loop

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src) return
    audio.src = src
    timeRef.current = 0
    setDisplayTime(0)
    setPlaying(false)
    setLoop(EMPTY_LOOP)

    const onMeta = () => setDuration(audio.duration || 0)
    const onEnded = () => setPlaying(false)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  useEffect(() => {
    let frame = 0
    let lastPush = 0

    const tick = (now: number) => {
      const audio = audioRef.current
      if (audio) {
        const { a, b, enabled } = loopRef.current
        if (enabled && a !== null && b !== null && audio.currentTime >= b) {
          audio.currentTime = a
        }
        timeRef.current = audio.currentTime
        if (now - lastPush > 100) {
          lastPush = now
          setDisplayTime(audio.currentTime)
        }
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds))
    timeRef.current = audio.currentTime
    setDisplayTime(audio.currentTime)
  }, [])

  const setVolume = useCallback((value: number) => {
    if (audioRef.current) audioRef.current.volume = value
  }, [])

  /** Marca o início do trecho no ponto atual. */
  const markA = useCallback(() => {
    setLoop((current) => {
      const a = timeRef.current
      // Marcar A depois de B invalida o fim: o trecho passa a ser aberto.
      const b = current.b !== null && current.b > a ? current.b : null
      return { a, b, enabled: b !== null }
    })
  }, [])

  /** Marca o fim do trecho e já entra em repetição. */
  const markB = useCallback(() => {
    setLoop((current) => {
      const b = timeRef.current
      if (current.a === null || current.a >= b) return current
      return { a: current.a, b, enabled: true }
    })
  }, [])

  const toggleLoop = useCallback(() => {
    setLoop((current) =>
      current.a === null || current.b === null ? current : { ...current, enabled: !current.enabled },
    )
  }, [])

  const clearLoop = useCallback(() => setLoop(EMPTY_LOOP), [])

  return {
    timeRef, displayTime, duration, playing, rate, loop,
    setRate, toggle, seek, setVolume, markA, markB, toggleLoop, clearLoop,
  }
}
