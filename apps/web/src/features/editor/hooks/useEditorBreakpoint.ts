import { useEffect, useState, type RefObject } from 'react'

export type EditorBreakpoint = 'mobile' | 'desktop'

export function useEditorBreakpoint(rootRef: RefObject<HTMLElement | null>): EditorBreakpoint {
  const [breakpoint, setBreakpoint] = useState<EditorBreakpoint>('desktop')

  useEffect(() => {
    const element = rootRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setBreakpoint(entry.contentRect.width < 540 ? 'mobile' : 'desktop')
    })
    observer.observe(element)
    setBreakpoint(element.getBoundingClientRect().width < 540 ? 'mobile' : 'desktop')
    return () => observer.disconnect()
  }, [rootRef])

  return breakpoint
}
