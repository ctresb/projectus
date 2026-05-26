import { AnimatePresence, motion } from 'motion/react'

export type NoticeValue = { tipo: 'ok' | 'erro' | 'info'; texto: string } | null

export function Notice({ notice }: { notice: NoticeValue }) {
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          className={`notice notice--${notice.tipo}`}
          role="status"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <strong>{notice.tipo === 'erro' ? 'ERR' : notice.tipo === 'ok' ? 'OK' : 'INFO'}</strong> {notice.texto}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

