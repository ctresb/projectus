import { Check, CloudOff, CloudUpload, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { triggerSnapshot, useSnapshotState } from '../hooks/useSnapshot'
import { EASE } from '../lib/motion'
import { useT } from '../i18n'

type Props = {
  onError?: (message: string) => void
  className?: string
  /** Exibido quando o botão está parado (idle). Default: snapshot.idle_default. */
  idleLabel?: string
}

export function SnapshotButton({ onError, className, idleLabel }: Props) {
  const t = useT()
  const state = useSnapshotState()
  const running = state.phase === 'running'
  const done = state.phase === 'done'
  const error = state.phase === 'error'
  const percent = state.arquivos_total > 0
    ? Math.min(100, Math.round((state.arquivos_enviados / state.arquivos_total) * 100))
    : running
      ? 0
      : 100

  const label = (() => {
    if (running) {
      const counter = state.arquivos_total > 0
        ? `${state.arquivos_enviados}/${state.arquivos_total}`
        : '…'
      return `${percent}% (${counter})`
    }
    if (done) return t('snapshot.done')
    if (error) return state.erro ?? t('snapshot.fail_short')
    return idleLabel ?? t('snapshot.idle_default')
  })()

  const icon = running ? (
    <Loader2 size={14} className="snapshot-button__spin" />
  ) : done ? (
    <Check size={14} />
  ) : error ? (
    <CloudOff size={14} />
  ) : (
    <CloudUpload size={14} />
  )

  return (
    <motion.button
      type="button"
      className={[
        'snapshot-button',
        running ? 'snapshot-button--running' : '',
        done ? 'snapshot-button--done' : '',
        error ? 'snapshot-button--error' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={running}
      whileHover={running ? undefined : { y: -1 }}
      whileTap={running ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: EASE }}
      onClick={() => {
        triggerSnapshot().catch((err) => {
          if (onError) onError(err instanceof Error ? err.message : t('snapshot.fail_full'))
        })
      }}
      title={error && state.erro ? state.erro : undefined}
      aria-live="polite"
    >
      <span
        className="snapshot-button__bar"
        style={{ width: `${running ? percent : done ? 100 : 0}%` }}
        aria-hidden
      />
      <span className="snapshot-button__content">
        {icon}
        <span className="snapshot-button__label">{label}</span>
      </span>
    </motion.button>
  )
}
