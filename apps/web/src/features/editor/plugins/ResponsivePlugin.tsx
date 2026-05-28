import { useEffect, type RefObject } from 'react'

export function ResponsivePlugin({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const viewport = window.visualViewport
    const root = rootRef.current
    if (!viewport || !root) return

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }

    updateInset()
    viewport.addEventListener('resize', updateInset)
    viewport.addEventListener('scroll', updateInset)
    return () => {
      viewport.removeEventListener('resize', updateInset)
      viewport.removeEventListener('scroll', updateInset)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [rootRef])

  return null
}
