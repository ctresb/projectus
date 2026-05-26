import { useEffect, type ReactNode, type MouseEvent } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { EASE } from '../lib/motion'

type Props = {
  aberto: boolean
  titulo: string
  children: ReactNode
  onClose: () => void
  amplo?: boolean
}

export function Modal({ aberto, titulo, children, onClose, amplo }: Props) {
  useEffect(() => {
    if (!aberto) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [aberto, onClose])

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE }}
          onMouseDown={closeOnBackdrop}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className={`modal ${amplo ? 'modal--amplo' : ''}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <header className="modal__head">
              <span className="eyebrow">{titulo}</span>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Fechar">
                <X size={16} />
              </button>
            </header>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
