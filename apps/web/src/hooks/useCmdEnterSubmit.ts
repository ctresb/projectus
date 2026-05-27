import { useEffect } from 'react'

export function useCmdEnterSubmit(active: boolean, handler: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (!(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      event.stopPropagation()
      handler()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, handler])
}
