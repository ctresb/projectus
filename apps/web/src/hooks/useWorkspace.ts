import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Bootstrap } from '../lib/types'

export function useWorkspace(enabled = true) {
  const [workspace, setWorkspace] = useState<Bootstrap | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      setWorkspace(await api.bootstrap())
      setErro(null)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'não foi possível carregar os dados')
    } finally {
      setCarregando(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    return api.events((event) => {
      // Backup events drive the SnapshotButton; they don't change board/ideas/config.
      if (event.tipo.startsWith('backup_')) return
      void refresh()
    })
  }, [enabled, refresh])

  return { workspace, setWorkspace, erro, carregando, refresh }
}
