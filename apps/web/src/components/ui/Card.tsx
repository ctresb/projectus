import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type CardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Card({ title, action, className, children, ...props }: CardProps) {
  return (
    <section className={cx('panel', className)} {...props}>
      {(title || action) && (
        <header>
          {title}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
