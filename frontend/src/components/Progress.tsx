import type { JobStatus, Stage } from '../types'

const STAGE_LABELS: Record<Stage, string> = {
  queued: 'Na fila',
  loading: 'Carregando o áudio',
  triage: 'Ouvindo que tipo de gravação é',
  separation: 'Separando os instrumentos',
  transcription: 'Transcrevendo as notas',
  score: 'Montando a partitura',
  done: 'Pronto',
}

const ORDER: Stage[] = ['loading', 'triage', 'separation', 'transcription', 'score']

interface Props {
  status: JobStatus
}

/** Um job de minutos precisa dizer o que está fazendo — barra muda não serve. */
export function Progress({ status }: Props) {
  const currentIndex = ORDER.indexOf(status.stage)

  return (
    <div className="surface mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h2 className="font-display text-xl">{status.filename}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {STAGE_LABELS[status.stage]}
          {status.queue_position ? ` — ${status.queue_position}º na fila` : ''}
        </p>
      </div>

      <div className="h-[3px] overflow-hidden rounded-full bg-rule">
        <div
          className="h-full rounded-full bg-felt transition-all duration-500"
          style={{ width: `${Math.round(status.progress * 100)}%` }}
        />
      </div>

      <ol className="space-y-2 text-sm">
        {ORDER.map((stage, index) => {
          // Separação só existe na rota de mixagem densa; nas outras é pulada.
          const skipped = stage === 'separation' && status.route === 'solo'
          const done = currentIndex > index
          const current = currentIndex === index
          return (
            <li
              key={stage}
              className={`flex items-center gap-3 ${
                done ? 'text-ink-soft' : current ? 'text-ink' : 'text-ink-faint'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  done ? 'bg-brass' : current ? 'animate-pulse bg-felt' : 'bg-rule-strong'
                }`}
              />
              {STAGE_LABELS[stage]}
              {skipped && <span className="text-ink-faint">— não necessária</span>}
            </li>
          )
        })}
      </ol>

      {status.device && (
        <p className="text-xs text-ink-faint">
          processando em {status.device === 'cpu' ? 'CPU' : status.device.toUpperCase()}
        </p>
      )}
    </div>
  )
}
