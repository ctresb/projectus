import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type ContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Container({ className, children, ...props }: ContainerProps) {
  return (
    <section className={cx('workspace', className)} {...props}>
      {children}
    </section>
  )
}

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: ReactNode
  title: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cx('section-head', className)} {...props}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {actions}
    </header>
  )
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Section({ className, children, ...props }: SectionProps) {
  return (
    <section className={className} {...props}>
      {children}
    </section>
  )
}
