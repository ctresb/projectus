import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type StateProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function EmptyState({ className, children, ...props }: StateProps) {
  return (
    <div className={cx('empty', className)} {...props}>
      {children}
    </div>
  )
}

export function LoadingState({ className, children, ...props }: StateProps) {
  return (
    <div className={cx('loading', className)} {...props}>
      {children}
    </div>
  )
}

export function ErrorState({ className, children, ...props }: StateProps) {
  return (
    <div className={cx('empty error-state', className)} {...props}>
      {children}
    </div>
  )
}
