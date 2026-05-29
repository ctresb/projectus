import { useCallback, useEffect, useRef, useState } from 'react'
import { ArchiveRestore, CheckSquare, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { cx } from '../../lib/classnames'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import type { ArchiveIndex, ArchivedItem } from '../../lib/types'
import { useT, type TFn } from '../../i18n'
import { Button, Checkbox, Container, EmptyState, LoadingState, PageHeader } from '../../components/ui'
import { ArchiveSelectionBar } from './ArchiveSelectionBar'
import { useArchiveSelection } from './useArchiveSelection'
import { useArchiveRestoration } from './useArchiveRestoration'
import { useArchiveDeletion } from './useArchiveDeletion'
import './archive.css'

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
  const [busy, setBusy] = useState(false)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const handledFocusToken = useRef<number | null>(null)

  const loadArchive = useCallback(async () => {
    const current = await api.archive()
    setArchive(current)
    return current
  }, [])

  const {
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
  } = useArchiveSelection(archive)

  const { restore, restoreSelected } = useArchiveRestoration({
    busy,
    setBusy,
    selectedIds,
    selectedItems,
    setArchive,
    loadArchive,
    cancelSelection,
    onRefresh,
    onMessage,
  })

  const { deleteOne, deleteSelected } = useArchiveDeletion({
    busy,
    setBusy,
    selectedIds,
    selectedItems,
    setArchive,
    setSelectedIds,
    loadArchive,
    cancelSelection,
    onMessage,
  })

  useEffect(() => {
    void loadArchive().catch((error: Error) => onMessage('erro', error.message))
    return api.events(() => void loadArchive().catch(() => undefined))
  }, [loadArchive, onMessage])

  useEffect(() => {
    if (!archive || !focusRequest || handledFocusToken.current === focusRequest.token) return
    handledFocusToken.current = focusRequest.token
    if (!archive.itens.some((item) => item.id === focusRequest.id)) return

    setFocusedItemId(focusRequest.id)
    const selector = `[data-archive-id="${focusRequest.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'center' }),
    )
    const timer = window.setTimeout(() => {
      setFocusedItemId((current) => (current === focusRequest.id ? null : current))
    }, 2600)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [archive, focusRequest])

  const items = archive?.itens ?? []

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
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => void deleteSelected()}
                    disabled={busy || selectedCount === 0}
                  >
                    <Trash2 size={14} /> {t('archive_view.delete')}
                  </Button>
                  <Button type="button" onClick={() => void restoreSelected()} disabled={busy || selectedCount === 0}>
                    <ArchiveRestore size={14} /> {t('archive_view.restore')}
                  </Button>
                </>
              )}
              <Button
                type="button"
                onClick={selectionMode ? cancelSelection : () => setSelectionMode(true)}
                disabled={busy}
              >
                {selectionMode ? <X size={14} /> : <CheckSquare size={14} />}
                {selectionMode ? t('archive_view.cancel_selection') : t('archive_view.select')}
              </Button>
            </div>
          )
        }
      />
      <SquareScrollArea className="archive-list" viewportClassName="archive-list__viewport">
        {selectionMode && archive && items.length > 0 && (
          <ArchiveSelectionBar
            allSelected={allSelected}
            busy={busy}
            selectedCount={selectedCount}
            total={items.length}
            onToggleAll={toggleAll}
          />
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

function label(entity: ArchivedItem['entidade'], t: TFn) {
  if (entity === 'projeto') return t('archive_view.entity_label.projeto')
  if (entity === 'tarefa') return t('archive_view.entity_label.tarefa')
  if (entity === 'ideia') return t('archive_view.entity_label.ideia')
  return t('archive_view.entity_label.item')
}
