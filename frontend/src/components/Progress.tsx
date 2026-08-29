import type { JobStatus, Stage } from '../types'

const STAGE_LABELS: Record<Stage, string> = {
  queued: 'Na fila',
  loading: 'Carregando o áudio',
  triage: 'Analisando o tipo de gravação',
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
    <div className="mx-auto max-w-xl space-y-5 rounded-lg border border-edge bg-panel p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{status.filename}</h2>
        <p className="text-sm text-slate-400">
          {STAGE_LABELS[status.stage]}
          {status.queue_position ? ` — ${status.queue_position}º na fila` : ''}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full bg-sky-500 transition-all duration-500"
          style={{ width: `${Math.round(status.progress * 100)}%` }}
        />
      </div>

      <ol className="space-y-1.5 text-sm">
        {ORDER.map((stage, index) => {
          // Separação só existe na rota de mixagem densa; nas outras é pulada.
          const skipped = stage === 'separation' && status.route === 'solo'
          const done = currentIndex > index
          return (
            <li
              key={stage}
              className={
                done ? 'text-emerald-400'
                : currentIndex === index ? 'text-white'
                : 'text-slate-500'
              }
            >
              {done ? '✓' : currentIndex === index ? '›' : '·'} {STAGE_LABELS[stage]}
              {skipped && ' (não necessária)'}
            </li>
          )
        })}
      </ol>

      {status.device && (
        <p className="text-xs text-slate-500">
          Processando em {status.device === 'cpu' ? 'CPU' : status.device.toUpperCase()}
        </p>
      )}
    </div>
  )
}
