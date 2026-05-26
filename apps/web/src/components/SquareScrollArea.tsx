import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

type Metrics = {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}

export function SquareScrollArea({
  children,
  className,
  columnId,
}: {
  children: ReactNode
  className?: string
  columnId?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startScrollTop: number } | null>(null)
  const [metrics, setMetrics] = useState<Metrics>({ clientHeight: 0, scrollHeight: 0, scrollTop: 0 })

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setMetrics({
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      scrollTop: viewport.scrollTop,
    })
  }, [])

  useLayoutEffect(() => {
    measure()
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    Array.from(viewport.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [children, measure])

  const overflowing = metrics.scrollHeight > metrics.clientHeight + 1
  const railHeight = railRef.current?.clientHeight ?? Math.max(0, metrics.clientHeight - 24)
  const thumbHeight = overflowing
    ? Math.max(30, Math.round((metrics.clientHeight / metrics.scrollHeight) * railHeight))
    : 0
  const travel = Math.max(0, railHeight - thumbHeight)
  const maxScroll = Math.max(1, metrics.scrollHeight - metrics.clientHeight)
  const thumbTop = Math.round((metrics.scrollTop / maxScroll) * travel)

  const onThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { startY: event.clientY, startScrollTop: metrics.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const viewport = viewportRef.current
    if (!drag || !viewport || travel <= 0) return
    event.preventDefault()
    viewport.scrollTop = drag.startScrollTop + ((event.clientY - drag.startY) / travel) * maxScroll
    measure()
  }

  const onThumbPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const rail = railRef.current
    if (!viewport || !rail || event.target !== rail) return
    const offset = event.clientY - rail.getBoundingClientRect().top - thumbHeight / 2
    viewport.scrollTop = (Math.max(0, Math.min(travel, offset)) / Math.max(1, travel)) * maxScroll
    measure()
  }

  return (
    <div className="square-scroll">
      <div
        className={`square-scroll__viewport ${className ?? ''}`}
        data-column-scroll={columnId}
        ref={viewportRef}
        onScroll={measure}
      >
        {children}
      </div>
      {overflowing && (
        <div aria-hidden className="square-scroll__rail" ref={railRef} onPointerDown={onRailPointerDown}>
          <div
            className="square-scroll__thumb"
            style={{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            onPointerCancel={onThumbPointerUp}
          />
        </div>
      )}
    </div>
  )
}
