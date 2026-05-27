import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type ButtonVariant = 'primary' | 'quiet' | 'danger'
type ButtonSize = 'md' | 'mini'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({ variant = 'quiet', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button className={cx('btn', variant && `btn--${variant}`, size === 'mini' && 'btn--mini', className)} {...props}>
      {children}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'danger'
  label: string
  children: ReactNode
}

export function IconButton({ tone = 'default', label, className, children, ...props }: IconButtonProps) {
  return (
    <button
      className={cx('icon-btn', tone === 'danger' && 'icon-btn--danger', className)}
      type="button"
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}
