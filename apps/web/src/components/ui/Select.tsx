import { ChevronDown, Check } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/classnames'

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label: string
  className?: string
}

export function Select({ value, options, onChange, label, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const [showActiveOption, setShowActiveOption] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(selectedIndex)
  }, [selectedIndex])

  useEffect(() => {
    setOpen(false)
  }, [value])

  const commit = (option: SelectOption) => {
    onChange(option.value)
    setOpen(false)
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    if (!open) {
      setOpen(true)
      setActiveIndex(selectedIndex)
      setShowActiveOption(true)
      return
    }
    setShowActiveOption(true)
    if (event.key === 'ArrowDown') {
      setActiveIndex((index) => Math.min(options.length - 1, index + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      setActiveIndex((index) => Math.max(0, index - 1))
      return
    }
    const optionToCommit = options[activeIndex] ?? selected
    if (optionToCommit) commit(optionToCommit)
  }

  return (
    <div
      className={cx('select', className)}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        className={cx('select__trigger', open && 'select__trigger--open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => {
          setActiveIndex(selectedIndex)
          setShowActiveOption(false)
          setOpen((current) => !current)
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={15} className="select__chevron" />
      </button>
      {open && (
        <div className="select__popover">
          <div
            id={listId}
            role="listbox"
            aria-label={label}
            className="select__list"
            onMouseLeave={() => setShowActiveOption(false)}
          >
            {options.map((option, index) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cx(
                    'select__option',
                    active && 'select__option--selected',
                    showActiveOption && index === activeIndex && 'select__option--active',
                  )}
                  onMouseEnter={() => {
                    setActiveIndex(index)
                    setShowActiveOption(true)
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    commit(option)
                  }}
                  onClick={() => commit(option)}
                >
                  <span>{option.label}</span>
                  {active && <Check size={14} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
