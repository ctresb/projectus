import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { ArchiveIndex, Bootstrap, DocumentResponse, Project } from '../../lib/types'
import { useT } from '../../i18n'
import { buildSearchEntries } from './searchIndex'

export function useGlobalSearchIndex(workspace: Bootstrap) {
  const t = useT()
  const [projectDocuments, setProjectDocuments] = useState<Array<DocumentResponse<Project>>>([])
  const [archive, setArchive] = useState<ArchiveIndex | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setProjectDocuments([])
    setArchive(null)
    setIndexError(null)
    setIndexing(true)

    const load = async () => {
      const [projectResults, archiveResult] = await Promise.all([
        Promise.allSettled(workspace.board.projetos.map((project) => api.project(project.id))),
        api.archive().then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason }),
        ),
      ])
      if (cancelled) return

      const loadedProjects = projectResults
        .filter((result): result is PromiseFulfilledResult<DocumentResponse<Project>> => result.status === 'fulfilled')
        .map((result) => result.value)
      setProjectDocuments(loadedProjects)

      if (archiveResult.status === 'fulfilled') setArchive(archiveResult.value)

      const failedProjects = projectResults.length - loadedProjects.length
      if (failedProjects > 0 || archiveResult.status === 'rejected') {
        setIndexError(t('search.partial_error'))
      }
      setIndexing(false)
    }

    void load().catch(() => {
      if (!cancelled) {
        setIndexError(t('search.partial_error'))
        setIndexing(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [t, workspace])

  const entries = useMemo(
    () => buildSearchEntries({ workspace, projectDocuments, archive, t }),
    [archive, projectDocuments, t, workspace],
  )

  return { entries, indexing, indexError }
}
