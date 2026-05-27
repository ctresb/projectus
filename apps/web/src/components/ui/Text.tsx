import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/classnames'

type TextTone = 'default' | 'muted' | 'subtle' | 'danger'

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: TextTone
  as?: 'p' | 'span' | 'small'
  children: ReactNode
}

export function Text({ tone = 'default', as: Component = 'p', className, children, ...props }: TextProps) {
  return (
    <Component className={cx(tone !== 'default' && `text--${tone}`, className)} {...props}>
      {children}
    </Component>
  )
}
