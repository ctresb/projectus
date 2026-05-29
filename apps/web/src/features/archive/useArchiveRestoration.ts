import { api } from '../../lib/api'
import type { ArchiveIndex, ArchivedItem, Board, Ideas } from '../../lib/types'
import { useT } from '../../i18n'

function createRevisionTracker(board: Board, ideas: Ideas) {
  let boardRevision = board.revision
  let ideasRevision = ideas.revision
  const projectRevisions = new Map<string, number>()

  return {
    async destination(item: ArchivedItem) {
      if (item.entidade === 'projeto') return boardRevision
      if (item.entidade === 'ideia') return ideasRevision
      if (!item.projeto_id) return 0
      if (!projectRevisions.has(item.projeto_id)) {
        projectRevisions.set(item.projeto_id, (await api.project(item.projeto_id)).dados.revision)
      }
      return projectRevisions.get(item.projeto_id) ?? 0
    },
    markRestored(item: ArchivedItem) {
      if (item.entidade === 'projeto') boardRevision += 1
      if (item.entidade === 'ideia') ideasRevision += 1
      if (item.entidade === 'tarefa' && item.projeto_id) {
        projectRevisions.set(item.projeto_id, (projectRevisions.get(item.projeto_id) ?? 0) + 1)
      }
    },
  }
}

export function useArchiveRestoration({
  busy,
  setBusy,
  selectedIds,
  selectedItems,
  setArchive,
  loadArchive,
  cancelSelection,
  onRefresh,
  onMessage,
}: {
  busy: boolean
  setBusy: (value: boolean) => void
  selectedIds: string[]
  selectedItems: ArchivedItem[]
  setArchive: (archive: ArchiveIndex) => void
  loadArchive: () => Promise<ArchiveIndex>
  cancelSelection: () => void
  onRefresh: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()

  const restore = async (item: ArchivedItem) => {
    if (busy) return
    setBusy(true)
    try {
      const currentArchive = await loadArchive()
      const currentItem = currentArchive.itens.find((candidate) => candidate.id === item.id)
      if (!currentItem) throw new Error(t('archive_view.fail_restore'))
      const workspace = await api.bootstrap()
      const revisions = createRevisionTracker(workspace.board, workspace.ideias)
      const destinoRevision = await revisions.destination(currentItem)
      const updated = await api.restoreArchived(currentItem.id, currentArchive.revision, destinoRevision)
      setArchive(updated)
      await onRefresh()
      await loadArchive()
      onMessage('ok', t('archive_view.restored'))
    } catch (error) {
      await loadArchive().catch(() => undefined)
      onMessage('erro', error instanceof Error ? error.message : t('archive_view.fail_restore'))
    } finally {
      setBusy(false)
    }
  }

  const restoreSelected = async () => {
    if (
      busy ||
      selectedItems.length === 0 ||
      !window.confirm(t('archive_view.confirm_restore_selected', { count: selectedItems.length }))
    )
      return
    setBusy(true)
    try {
      let currentArchive = await loadArchive()
      const currentItems = currentArchive.itens.filter((item) => selectedIds.includes(item.id))
      const workspace = await api.bootstrap()
      const revisions = createRevisionTracker(workspace.board, workspace.ideias)
      for (const item of currentItems) {
        const destinoRevision = await revisions.destination(item)
        currentArchive = await api.restoreArchived(item.id, currentArchive.revision, destinoRevision)
        revisions.markRestored(item)
      }
      setArchive(currentArchive)
      cancelSelection()
      await onRefresh()
      await loadArchive()
      onMessage('ok', t('archive_view.restored_selected', { count: currentItems.length }))
    } catch (error) {
      await loadArchive().catch(() => undefined)
      onMessage('erro', error instanceof Error ? error.message : t('archive_view.fail_restore'))
    } finally {
      setBusy(false)
    }
  }

  return { restore, restoreSelected }
}
