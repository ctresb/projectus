import { useEffect, useState } from 'react'
import { ArchiveRestore } from 'lucide-react'
import { api } from '../../lib/api'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import type { ArchiveIndex, ArchivedItem, Board, Ideas } from '../../lib/types'
import { useT, type TFn } from '../../i18n'
import { Button, Container, EmptyState, LoadingState, PageHeader } from '../../components/ui'

export function ArchiveView({
  board,
  ideas,
  onRefresh,
  onMessage,
}: {
  board: Board
  ideas: Ideas
  onRefresh: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [archive, setArchive] = useState<ArchiveIndex | null>(null)

  useEffect(() => {
    void api.archive().then(setArchive).catch((error: Error) => onMessage('erro', error.message))
    return api.events(() => void api.archive().then(setArchive).catch(() => undefined))
  }, [onMessage])

  const restore = async (item: ArchivedItem) => {
    if (!archive) return
    try {
      const destinoRevision =
        item.entidade === 'projeto'
          ? board.revision
          : item.entidade === 'ideia'
            ? ideas.revision
            : item.projeto_id
              ? (await api.project(item.projeto_id)).dados.revision
              : 0
      setArchive(await api.restoreArchived(item.id, archive.revision, destinoRevision))
      await onRefresh()
      onMessage('ok', t('archive_view.restored'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('archive_view.fail_restore'))
    }
  }

  return (
    <Container className="archive">
      <PageHeader eyebrow={t('archive_view.eyebrow')} title={t('archive_view.title')} />
      <SquareScrollArea className="archive-list" viewportClassName="archive-list__viewport">
        {archive?.itens.map((item) => (
          <article className="archive-item" key={item.id}>
            <div>
              <span className="eyebrow">{label(item.entidade, t)}</span>
              <h2>{item.titulo}</h2>
              {item.projeto_titulo && <p>{t('archive_view.project_of', { titulo: item.projeto_titulo })}</p>}
              <time>{new Date(item.arquivado_em).toLocaleString('pt-BR')}</time>
            </div>
            {item.entidade === 'desconhecido' ? (
              <small>{t('archive_view.legacy_item')}</small>
            ) : (
              <Button type="button" onClick={() => void restore(item)}>
                <ArchiveRestore size={14} /> {t('archive_view.restore')}
              </Button>
            )}
          </article>
        ))}
        {archive && archive.itens.length === 0 && <EmptyState>{t('archive_view.empty')}</EmptyState>}
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
