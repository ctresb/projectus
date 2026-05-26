import { useEffect } from 'react'

type Options = {
  ativo: boolean
  onNovo: (tituloInicial: string) => void
}

export function useQuickCreate({ ativo, onNovo }: Options) {
  useEffect(() => {
    if (!ativo) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const editing =
        target !== null &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          Boolean(target.closest('[role="dialog"]')))
      if (editing) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onNovo('')
        return
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1 && event.key.trim()) {
        event.preventDefault()
        onNovo(event.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ativo, onNovo])
}
