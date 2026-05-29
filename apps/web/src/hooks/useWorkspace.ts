import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Bootstrap } from '../lib/types'

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Bootstrap | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setWorkspace(await api.bootstrap())
      setErro(null)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'não foi possível carregar os dados')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return api.events((event) => {
      // Backup events drive the SnapshotButton; they don't change board/notes/config.
      if (event.tipo.startsWith('backup_')) return
      void refresh()
    })
  }, [refresh])

  return { workspace, setWorkspace, erro, carregando, refresh }
}

