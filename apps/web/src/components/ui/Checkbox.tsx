import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  label?: ReactNode
  onCheckedChange: (checked: boolean) => void
}

export function Checkbox({ checked, className, disabled, label, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <label className={cx('checkbox', disabled && 'checkbox--disabled', className)}>
      <input
        {...props}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className="checkbox__box" aria-hidden="true" />
      {label && <span className="checkbox__label">{label}</span>}
    </label>
  )
}
