import { useCallback, useEffect, useRef } from 'react'
import { markError, markIdle, markSaved, markSaving, useSaveStatus, type SaveStatus } from './useSaveStatus'

type AutosaveOptions<T> = {
  ativo: boolean
  dirty: boolean
  documentKey: string
  onStart: () => void
  save: (signal: AbortSignal) => Promise<T>
  onSaved: (saved: T) => void | Promise<void>
  onError: (message: string) => void
  baseDebounceMs?: number
  maxDebounceMs?: number
  retryBackoffMs?: number[]
}

type AutosaveResult = {
  flush: () => Promise<void>
  status: SaveStatus
}

const DEFAULT_RETRY_BACKOFF_MS = [800, 1600, 3200]

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

export function useDocumentAutosave<T>({
  ativo,
  dirty,
  documentKey,
  onStart,
  save,
  onSaved,
  onError,
  baseDebounceMs = 600,
  maxDebounceMs = 1800,
  retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
}: AutosaveOptions<T>): AutosaveResult {
  const { status } = useSaveStatus()
  const actions = useRef({ onError, onSaved, onStart, save })
  const retryBackoff = useRef(retryBackoffMs)
  const timer = useRef<number | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const dirtyTicks = useRef<number[]>([])
  actions.current = { onError, onSaved, onStart, save }
  retryBackoff.current = retryBackoffMs

  const clearTimer = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
  }, [])

  const abortInFlight = useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
  }, [])

  const debounceMs = useCallback(() => {
    const now = Date.now()
    dirtyTicks.current = [...dirtyTicks.current.slice(-4), now]
    if (dirtyTicks.current.length < 2) return baseDebounceMs
    const gaps = dirtyTicks.current.slice(1).map((tick, index) => tick - dirtyTicks.current[index])
    const averageGap = gaps.reduce((total, gap) => total + gap, 0) / gaps.length
    return averageGap < 200 ? maxDebounceMs : baseDebounceMs
  }, [baseDebounceMs, maxDebounceMs])

  const runSave = useCallback(async () => {
    abortInFlight()
    const controller = new AbortController()
    inFlight.current = controller
    markSaving()
    actions.current.onStart()

    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const saved = await actions.current.save(controller.signal)
          if (controller.signal.aborted) {
            markIdle()
            return
          }
          markSaved()
          await actions.current.onSaved(saved)
          return
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            markIdle()
            return
          }
          const backoff = retryBackoff.current[attempt]
          if (backoff === undefined) {
            const message = messageFrom(error)
            markError(message)
            actions.current.onError(message)
            throw error
          }
          await delay(backoff, controller.signal)
        }
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null
    }
  }, [abortInFlight])

  useEffect(() => {
    clearTimer()
    abortInFlight()
    dirtyTicks.current = []
    markIdle()
  }, [abortInFlight, clearTimer, documentKey])

  useEffect(() => {
    clearTimer()
    if (!ativo || !dirty) return
    timer.current = window.setTimeout(() => {
      timer.current = null
      void runSave().catch(() => {})
    }, debounceMs())
    return clearTimer
  }, [ativo, clearTimer, debounceMs, dirty, documentKey, runSave])

  useEffect(
    () => () => {
      clearTimer()
      abortInFlight()
    },
    [abortInFlight, clearTimer],
  )

  const flush = useCallback(async () => {
    clearTimer()
    await runSave()
  }, [clearTimer, runSave])

  return { flush, status }
}
