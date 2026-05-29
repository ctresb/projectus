import { useEffect, useState } from 'react'
import type { ArchiveIndex, ArchivedItem } from '../../lib/types'

export function useArchiveSelection(archive: ArchiveIndex | null) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!archive) return
    const visibleIds = new Set(archive.itens.map((item) => item.id))
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)))
    if (archive.itens.length === 0) setSelectionMode(false)
  }, [archive])

  const items = archive?.itens ?? []
  const selectedItems = items.filter((item) => selectedIds.includes(item.id))
  const selectedCount = selectedIds.length
  const allSelected = items.length > 0 && selectedCount === items.length

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds([])
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : items.map((item: ArchivedItem) => item.id))
  }

  return {
    selectionMode,
    setSelectionMode,
    selectedIds,
    setSelectedIds,
    selectedItems,
    selectedCount,
    allSelected,
    cancelSelection,
    toggleSelected,
    toggleAll,
  }
}
