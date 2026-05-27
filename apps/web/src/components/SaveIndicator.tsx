import { AnimatePresence, motion } from 'motion/react'
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useSaveStatus } from '../hooks/useSaveStatus'
import { EASE } from '../lib/motion'
import { useT } from '../i18n'

const tone: Record<string, string> = {
  idle: 'save-indicator--idle',
  saving: 'save-indicator--saving',
  saved: 'save-indicator--saved',
  error: 'save-indicator--error',
}

export function SaveIndicator() {
  const state = useSaveStatus()
  const t = useT()
  const label = t(`save_indicator.${state.status}`)
  const icon =
    state.status === 'saving' ? (
      <Loader2 size={14} className="save-indicator__spin" />
    ) : state.status === 'error' ? (
      <CloudOff size={14} />
    ) : (
      <Check size={14} />
    )
  return (
    <div className={`save-indicator ${tone[state.status]}`} title={state.errorMessage ?? label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state.status}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.12, ease: EASE }}
          className="save-indicator__inner"
        >
          {icon}
          <span className="save-indicator__label">{label}</span>
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
