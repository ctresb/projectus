import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Config } from '../../lib/types'
import { markError, markSaved, markSaving } from '../../hooks/useSaveStatus'

export function useSettingsAutosave({
  config,
  onConfig,
  onMessage,
}: {
  config: Config
  onConfig: (config: Config) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [draft, setDraft] = useState(config)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(config)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const onConfigRef = useRef(onConfig)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onConfigRef.current = onConfig
    onMessageRef.current = onMessage
  }, [onConfig, onMessage])

  useEffect(() => {
    dirtyRef.current = dirty
    savingRef.current = saving
  }, [dirty, saving])

  useEffect(() => {
    if (dirty || saving) return
    draftRef.current = config
    setDraft(config)
  }, [config, dirty, saving])

  const persistConfig = useCallback(async (submitted: Config, updateMountedState: boolean) => {
    try {
      const saved = await api.updateConfig(submitted)
      const hasNewerChange = draftRef.current !== submitted
      const next = hasNewerChange ? { ...draftRef.current, revision: saved.revision } : saved
      draftRef.current = next
      onConfigRef.current(next)
      if (updateMountedState && mountedRef.current) {
        setDraft(next)
        if (hasNewerChange) {
          dirtyRef.current = true
          setDirty(true)
        } else {
          markSaved()
        }
      } else if (!hasNewerChange) {
        markSaved()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro ao salvar ajustes'
      markError(message)
      onMessageRef.current('erro', message)
      if (!updateMountedState || !mountedRef.current) return
      const fresh = (await api.bootstrap()).config
      draftRef.current = fresh
      setDraft(fresh)
      onConfigRef.current(fresh)
    }
  }, [])

  useEffect(() => {
    if (!dirty || saving) return
    markSaving()
    const timer = window.setTimeout(() => {
      const submitted = draftRef.current
      dirtyRef.current = false
      savingRef.current = true
      setDirty(false)
      setSaving(true)
      void persistConfig(submitted, true).finally(() => {
        savingRef.current = false
        if (mountedRef.current) setSaving(false)
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [dirty, persistConfig, saving])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (!dirtyRef.current || savingRef.current) return
      const submitted = draftRef.current
      dirtyRef.current = false
      savingRef.current = true
      markSaving()
      void persistConfig(submitted, false).finally(() => {
        savingRef.current = false
      })
    }
  }, [persistConfig])

  const change = useCallback((next: Config) => {
    draftRef.current = next
    setDraft(next)
    onConfigRef.current(next)
    dirtyRef.current = true
    setDirty(true)
  }, [])

  return { draft, dirty, saving, change }
}
