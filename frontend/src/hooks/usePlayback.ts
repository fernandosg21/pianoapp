import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Relógio único do app.
 *
 * O elemento <audio> é a fonte de verdade do tempo — nada de timer paralelo, que é
 * o que faria o piano roll sair de sincronia com o som depois de alguns minutos.
 *
 * O tempo vive num ref atualizado a cada quadro (o canvas lê dali, sem provocar
 * render) e num state atualizado poucas vezes por segundo, só para os textos.
 */
export function usePlayback(src: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timeRef = useRef(0)
  const [displayTime, setDisplayTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)

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

  return { timeRef, displayTime, duration, playing, rate, setRate, toggle, seek, setVolume }
}
