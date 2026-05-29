import { api } from '../../lib/api'
import type { ArchiveIndex, ArchivedItem } from '../../lib/types'
import { useT } from '../../i18n'

export function useArchiveDeletion({
  busy,
  setBusy,
  selectedIds,
  selectedItems,
  setArchive,
  setSelectedIds,
  loadArchive,
  cancelSelection,
  onMessage,
}: {
  busy: boolean
  setBusy: (value: boolean) => void
  selectedIds: string[]
  selectedItems: ArchivedItem[]
  setArchive: (archive: ArchiveIndex) => void
  setSelectedIds: (updater: (current: string[]) => string[]) => void
  loadArchive: () => Promise<ArchiveIndex>
  cancelSelection: () => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()

  const deleteOne = async (item: ArchivedItem) => {
    if (busy || !window.confirm(t('archive_view.confirm_delete_one', { titulo: item.titulo }))) return
    setBusy(true)
    try {
      const currentArchive = await loadArchive()
      const currentItem = currentArchive.itens.find((candidate) => candidate.id === item.id)
      if (!currentItem) throw new Error(t('archive_view.fail_delete'))
      setArchive(await api.deleteArchived(currentItem.id, currentArchive.revision))
      await loadArchive()
      setSelectedIds((current) => current.filter((id) => id !== item.id))
      onMessage('ok', t('archive_view.deleted'))
    } catch (error) {
      await loadArchive().catch(() => undefined)
      onMessage('erro', error instanceof Error ? error.message : t('archive_view.fail_delete'))
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (
      busy ||
      selectedItems.length === 0 ||
      !window.confirm(t('archive_view.confirm_delete_selected', { count: selectedItems.length }))
    )
      return
    setBusy(true)
    try {
      let currentArchive = await loadArchive()
      const currentItems = currentArchive.itens.filter((item) => selectedIds.includes(item.id))
      for (const item of currentItems) {
        currentArchive = await api.deleteArchived(item.id, currentArchive.revision)
      }
      setArchive(currentArchive)
      cancelSelection()
      await loadArchive()
      onMessage('ok', t('archive_view.deleted_selected', { count: currentItems.length }))
    } catch (error) {
      await loadArchive().catch(() => undefined)
      onMessage('erro', error instanceof Error ? error.message : t('archive_view.fail_delete'))
    } finally {
      setBusy(false)
    }
  }

  return { deleteOne, deleteSelected }
}
