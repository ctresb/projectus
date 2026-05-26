import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { ColorChoice } from '../lib/types'
import { EASE } from '../lib/motion'

type Props = {
  cores: ColorChoice[]
  value: string
  onChange: (color: string) => void
  label?: string
}

type Position = { left: number; top: number } | null

export function ColorPicker({ cores, value, onChange, label = 'Escolher cor' }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return
    const margin = 8
    const gap = 6
    const trigger = triggerRef.current.getBoundingClientRect()
    const panel = panelRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(margin, trigger.left), window.innerWidth - panel.width - margin)
    const below = trigger.bottom + gap
    const top = below + panel.height <= window.innerHeight - margin ? below : trigger.top - panel.height - gap
    setPosition({ left, top: Math.max(margin, top) })
  }, [cores.length, open])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const closeOnLayoutChange = () => setOpen(false)
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnLayoutChange)
    window.addEventListener('scroll', closeOnLayoutChange, true)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnLayoutChange)
      window.removeEventListener('scroll', closeOnLayoutChange, true)
    }
  }, [open])

  return (
    <>
      <span className="color-picker">
        <motion.button
          ref={triggerRef}
          type="button"
          className="color-picker__trigger"
          aria-label={label}
          aria-controls={id}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          style={{ '--swatch': value } as CSSProperties}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12, ease: EASE }}
        />
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id={id}
              className="color-picker__panel"
              style={position ?? { visibility: 'hidden' }}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: EASE }}
              role="listbox"
              aria-label={label}
            >
              {cores.map((color) => (
                <motion.button
                  className={`color-picker__option ${value === color.valor ? 'color-picker__option--active' : ''}`}
                  type="button"
                  key={color.id}
                  style={{ '--swatch': color.valor } as CSSProperties}
                  aria-label={color.titulo}
                  aria-selected={value === color.valor}
                  role="option"
                  whileHover={{ y: -1 }}
                  onClick={() => {
                    onChange(color.valor)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
