import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type FieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
}

export function Field({ label, hint, error, className, children, ...props }: FieldProps) {
  return (
    <label className={className} {...props}>
      {label}
      {children}
      {hint && <small className="hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return <input className={cx(className)} {...props} />
}
