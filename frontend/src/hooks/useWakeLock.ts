import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'active' | 'idle' | 'unsupported' | 'insecure'

interface WakeLockSentinel {
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

/**
 * Mantém a tela acesa enquanto o áudio toca.
 *
 * Estudar com o app significa olhar o piano roll por minutos sem tocar na tela, e
 * o bloqueio automático do iPad cortaria isso.
 *
 * A Wake Lock API exige contexto seguro — HTTPS ou localhost. Acessando pelo IP da
 * rede local, em HTTP, o navegador simplesmente não a expõe. Nesse caso reportamos
 * 'insecure' e a interface orienta a desativar o bloqueio automático, que é a saída
 * confiável. Preferimos dizer isso do que fingir que está funcionando.
 */
export function useWakeLock(shouldHold: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    if (!supported) {
      setStatus(window.isSecureContext ? 'unsupported' : 'insecure')
      return
    }
    try {
      const sentinel = await (navigator as Navigator & {
        wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> }
      }).wakeLock.request('screen')
      sentinelRef.current = sentinel
      sentinel.addEventListener('release', () => setStatus('idle'))
      setStatus('active')
    } catch {
      // Acontece quando a aba perde o foco ou a bateria está em modo econômico.
      setStatus(window.isSecureContext ? 'idle' : 'insecure')
    }
  }, [supported])

  const release = useCallback(async () => {
    await sentinelRef.current?.release().catch(() => undefined)
    sentinelRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => {
    if (shouldHold) void acquire()
    else void release()
    return () => {
      void release()
    }
  }, [shouldHold, acquire, release])

  // O iOS solta o bloqueio ao voltar de segundo plano; é preciso pedir de novo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && shouldHold) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [shouldHold, acquire])

  return status
}
