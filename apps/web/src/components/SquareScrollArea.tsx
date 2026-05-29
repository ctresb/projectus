import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import './square-scroll.css'

type Metrics = {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function SquareScrollArea({
  children,
  className,
  viewportClassName,
  columnId,
}: {
  children: ReactNode
  className?: string
  viewportClassName?: string
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
    ? Math.min(railHeight, Math.max(30, Math.round((metrics.clientHeight / metrics.scrollHeight) * railHeight)))
    : 0
  const travel = Math.max(0, railHeight - thumbHeight)
  const scrollRange = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
  const maxScroll = Math.max(1, scrollRange)
  const boundedScrollTop = clamp(metrics.scrollTop, 0, scrollRange)
  const thumbTop = Math.round((boundedScrollTop / maxScroll) * travel)

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
    viewport.scrollTop = clamp(
      drag.startScrollTop + ((event.clientY - drag.startY) / travel) * scrollRange,
      0,
      scrollRange,
    )
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
    viewport.scrollTop = (clamp(offset, 0, travel) / Math.max(1, travel)) * scrollRange
    measure()
  }

  return (
    <div className={`square-scroll ${className ?? ''}`} data-overflowing={overflowing ? 'true' : 'false'}>
      <div
        className={`square-scroll__viewport ${viewportClassName ?? ''}`}
        data-column-scroll={columnId}
        data-overflowing={overflowing ? 'true' : 'false'}
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
