import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ColorChoice } from '../lib/types'

type Props = {
  cores: ColorChoice[]
  value: string
  onChange: (color: string) => void
  label?: string
}

export function ColorSwatchButton({ cores, value, onChange, label = 'Cor' }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="swatch-pop" ref={containerRef}>
      <button
        type="button"
        className="swatch-pop__trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{ '--swatch': value } as CSSProperties}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            className="swatch-pop__panel"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
            role="listbox"
          >
            {cores.map((color) => (
              <button
                className={`palette__swatch ${value === color.valor ? 'palette__swatch--active' : ''}`}
                type="button"
                key={color.id}
                style={{ '--swatch': color.valor } as CSSProperties}
                aria-label={color.titulo}
                aria-pressed={value === color.valor}
                onClick={() => {
                  onChange(color.valor)
                  setOpen(false)
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
