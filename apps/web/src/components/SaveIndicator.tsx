import { AnimatePresence, motion } from 'motion/react'
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useSaveStatus } from '../hooks/useSaveStatus'

const tone: Record<string, string> = {
  idle: 'save-indicator--idle',
  saving: 'save-indicator--saving',
  saved: 'save-indicator--saved',
  error: 'save-indicator--error',
}

const label: Record<string, string> = {
  idle: 'salvo localmente',
  saving: 'salvando...',
  saved: 'salvo localmente',
  error: 'erro ao salvar',
}

export function SaveIndicator() {
  const state = useSaveStatus()
  const icon =
    state.status === 'saving' ? (
      <Loader2 size={14} className="save-indicator__spin" />
    ) : state.status === 'error' ? (
      <CloudOff size={14} />
    ) : (
      <Check size={14} />
    )
  return (
    <div className={`save-indicator ${tone[state.status]}`} title={state.errorMessage ?? label[state.status]}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state.status}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
          className="save-indicator__inner"
        >
          {icon}
          <span className="save-indicator__label">{label[state.status]}</span>
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
