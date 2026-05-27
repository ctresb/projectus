import { AnimatePresence, motion } from 'motion/react'
import { useT } from '../i18n'

export type NoticeValue = { tipo: 'ok' | 'erro' | 'info'; texto: string } | null

export function Notice({ notice }: { notice: NoticeValue }) {
  const t = useT()
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
          <strong>{t(`notice.${notice.tipo}`)}</strong> {notice.texto}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
