import { useCallback, useEffect, useRef, useState } from 'react'
import { ArchiveRestore, CheckSquare, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { cx } from '../../lib/classnames'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import type { ArchiveIndex, ArchivedItem, Board, Ideas } from '../../lib/types'
import { useT, type TFn } from '../../i18n'
import { Button, Checkbox, Container, EmptyState, LoadingState, PageHeader } from '../../components/ui'

export function ArchiveView({
  focusRequest,
  onRefresh,
  onMessage,
}: {
  focusRequest?: { id: string; token: number } | null
  onRefresh: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [archive, setArchive] = useState<ArchiveIndex | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const handledFocusToken = useRef<number | null>(null)

  const loadArchive = useCallback(async () => {
    const current = await api.archive()
    setArchive(current)
    return current
  }, [])

  useEffect(() => {
    void loadArchive().catch((error: Error) => onMessage('erro', error.message))
    return api.events(() => void loadArchive().catch(() => undefined))
  }, [loadArchive, onMessage])

  useEffect(() => {
    if (!archive) return
    const visibleIds = new Set(archive.itens.map((item) => item.id))
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)))
    if (archive.itens.length === 0) setSelectionMode(false)
  }, [archive])

  useEffect(() => {
    if (!archive || !focusRequest || handledFocusToken.current === focusRequest.token) return
    handledFocusToken.current = focusRequest.token
    if (!archive.itens.some((item) => item.id === focusRequest.id)) return

    setFocusedItemId(focusRequest.id)
    const selector = `[data-archive-id="${focusRequest.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'center' }))
    const timer = window.setTimeout(() => {
      setFocusedItemId((current) => (current === focusRequest.id ? null : current))
    }, 2600)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [archive, focusRequest])

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
    setSelectedIds(allSelected ? [] : items.map((item) => item.id))
  }

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

  const restoreSelected = async () => {
    if (busy || selectedItems.length === 0 || !window.confirm(t('archive_view.confirm_restore_selected', { count: selectedItems.length }))) return
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

  const deleteSelected = async () => {
    if (busy || selectedItems.length === 0 || !window.confirm(t('archive_view.confirm_delete_selected', { count: selectedItems.length }))) return
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

  return (
    <Container className="archive">
      <PageHeader
        eyebrow={t('archive_view.eyebrow')}
        title={t('archive_view.title')}
        actions={
          archive &&
          items.length > 0 && (
            <div className="archive-header-actions">
              {selectionMode && (
                <>
                  <Button variant="danger" type="button" onClick={() => void deleteSelected()} disabled={busy || selectedCount === 0}>
                    <Trash2 size={14} /> {t('archive_view.delete')}
                  </Button>
                  <Button type="button" onClick={() => void restoreSelected()} disabled={busy || selectedCount === 0}>
                    <ArchiveRestore size={14} /> {t('archive_view.restore')}
                  </Button>
                </>
              )}
              <Button type="button" onClick={selectionMode ? cancelSelection : () => setSelectionMode(true)} disabled={busy}>
                {selectionMode ? <X size={14} /> : <CheckSquare size={14} />}
                {selectionMode ? t('archive_view.cancel_selection') : t('archive_view.select')}
              </Button>
            </div>
          )
        }
      />
      <SquareScrollArea className="archive-list" viewportClassName="archive-list__viewport">
        {selectionMode && archive && items.length > 0 && (
          <div className="archive-selection-bar">
            <Checkbox
              aria-label={t('archive_view.aria_select_all')}
              checked={allSelected}
              className="archive-checkbox-label"
              disabled={busy}
              label={t('archive_view.selected_count', { selected: selectedCount, total: items.length })}
              onCheckedChange={toggleAll}
            />
          </div>
        )}
        {items.map((item) => (
          <article
            className={cx(
              'archive-item',
              selectionMode && 'archive-item--selecting',
              focusedItemId === item.id && 'archive-item--focused',
            )}
            data-archive-id={item.id}
            key={item.id}
          >
            {selectionMode && (
              <Checkbox
                aria-label={t('archive_view.aria_select_item', { titulo: item.titulo })}
                checked={selectedIds.includes(item.id)}
                className="archive-item__checkbox"
                disabled={busy}
                onCheckedChange={() => toggleSelected(item.id)}
              />
            )}
            <div className="archive-item__body">
              <span className="eyebrow">{label(item.entidade, t)}</span>
              <h2>{item.titulo}</h2>
              {item.projeto_titulo && <p>{t('archive_view.project_of', { titulo: item.projeto_titulo })}</p>}
              <time>{new Date(item.arquivado_em).toLocaleString('pt-BR')}</time>
            </div>
            {!selectionMode && (
              <div className="archive-item__actions">
                <Button type="button" onClick={() => void restore(item)} disabled={busy}>
                  <ArchiveRestore size={14} /> {t('archive_view.restore')}
                </Button>
                <Button variant="danger" type="button" onClick={() => void deleteOne(item)} disabled={busy}>
                  <Trash2 size={14} /> {t('archive_view.delete')}
                </Button>
              </div>
            )}
          </article>
        ))}
        {archive && items.length === 0 && <EmptyState>{t('archive_view.empty')}</EmptyState>}
        {!archive && <LoadingState>{t('archive_view.loading')}</LoadingState>}
      </SquareScrollArea>
    </Container>
  )
}

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

function label(entity: ArchivedItem['entidade'], t: TFn) {
  if (entity === 'projeto') return t('archive_view.entity_label.projeto')
  if (entity === 'tarefa') return t('archive_view.entity_label.tarefa')
  if (entity === 'ideia') return t('archive_view.entity_label.ideia')
  return t('archive_view.entity_label.item')
}
