import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

type Placement = 'above' | 'below'

export function useFloatingPosition(
  targetRect: DOMRect | null,
  floatingRef: RefObject<HTMLElement | null>,
  placement: Placement = 'above',
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    const floating = floatingRef.current
    if (!targetRect || !floating) {
      setStyle({ visibility: 'hidden' })
      return
    }

    const margin = 8
    const width = floating.offsetWidth
    const height = floating.offsetHeight
    const left = Math.min(
      Math.max(margin, targetRect.left + targetRect.width / 2 - width / 2),
      window.innerWidth - width - margin,
    )
    const aboveTop = targetRect.top - height - margin
    const top = placement === 'below' || aboveTop < margin ? targetRect.bottom + margin : aboveTop
    setStyle({ left, position: 'fixed', top, visibility: 'visible', zIndex: 120 })
  }, [floatingRef, placement, targetRect])

  return style
}
