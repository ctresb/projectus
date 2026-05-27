import { useCallback, useEffect, useRef } from 'react'
import { markError, markSaved, markSaving } from './useSaveStatus'

export function useDocumentAutosave<T>({
  ativo,
  dirty,
  documentKey,
  onStart,
  save,
  onSaved,
  onError,
}: {
  ativo: boolean
  dirty: boolean
  documentKey: string
  onStart: () => void
  save: () => Promise<T>
  onSaved: (saved: T) => void | Promise<void>
  onError: (message: string) => void
}) {
  const actions = useRef({ onStart, save, onSaved, onError })
  actions.current = { onStart, save, onSaved, onError }

  useEffect(() => {
    if (!ativo || !dirty) return
    markSaving()
    const timer = window.setTimeout(() => {
      actions.current.onStart()
      void actions.current
        .save()
        .then(async (saved) => {
          markSaved()
          await actions.current.onSaved(saved)
        })
        .catch((error: Error) => {
          markError(error.message)
          actions.current.onError(error.message)
        })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [ativo, dirty, documentKey])

  const flush = useCallback(async () => {
    markSaving()
    actions.current.onStart()
    try {
      const saved = await actions.current.save()
      markSaved()
      await actions.current.onSaved(saved)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      markError(message)
      actions.current.onError(message)
      throw error
    }
  }, [])

  return { flush }
}
