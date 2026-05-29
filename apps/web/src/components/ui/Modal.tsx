import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { EASE } from '../../lib/motion'
import { useT } from '../../i18n'
import { IconButton } from './Button'
import { cx } from '../../lib/classnames'

type ModalPlacement = 'side' | 'center'
const modalStack: symbol[] = []

type Props = {
  aberto: boolean
  titulo: string
  children: ReactNode
  onClose: () => void
  amplo?: boolean
}

type ModalContainerProps = {
  aberto: boolean
  children: ReactNode
  onClose: () => void
  placement?: ModalPlacement
  className?: string
}

type ModalContentProps = {
  titulo: string
  children: ReactNode
  onClose: () => void
  amplo?: boolean
  placement?: ModalPlacement
  className?: string
}

export function ModalContainer({ aberto, children, onClose, placement = 'side', className }: ModalContainerProps) {
  const stackId = useRef(Symbol('modal'))

  useEffect(() => {
    if (!aberto) return
    const id = stackId.current
    modalStack.push(id)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalStack[modalStack.length - 1] === id) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      const index = modalStack.lastIndexOf(id)
      if (index >= 0) modalStack.splice(index, 1)
    }
  }, [aberto, onClose])

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className={cx('modal-backdrop', placement === 'center' && 'modal-backdrop--center', className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE }}
          onMouseDown={closeOnBackdrop}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ModalContent({ titulo, children, onClose, amplo, placement = 'side', className }: ModalContentProps) {
  const t = useT()
  const animation =
    placement === 'center'
      ? {
          initial: { opacity: 0, y: -14, scale: 0.985 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -14, scale: 0.985 },
        }
      : {
          initial: { opacity: 0, x: 24 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 24 },
        }

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className={cx('modal', placement === 'center' && 'modal--center', amplo && 'modal--amplo', className)}
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      transition={{ duration: 0.18, ease: EASE }}
    >
      <header className="modal__head">
        <span className="eyebrow">{titulo}</span>
        <IconButton label={t('modal.close')} onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      {children}
    </motion.section>
  )
}

export function Modal({ aberto, titulo, children, onClose, amplo }: Props) {
  return (
    <ModalContainer aberto={aberto} onClose={onClose}>
      <ModalContent titulo={titulo} amplo={amplo} onClose={onClose}>
        {children}
      </ModalContent>
    </ModalContainer>
  )
}
