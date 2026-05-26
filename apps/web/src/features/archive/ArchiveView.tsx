import { useEffect, useState } from 'react'
import { ArchiveRestore } from 'lucide-react'
import { api } from '../../lib/api'
import type { ArchiveIndex, ArchivedItem, Board, Ideas } from '../../lib/types'

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
      onMessage('ok', 'item restaurado do Arquivo')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível restaurar')
    }
  }

  return (
    <section className="archive workspace">
      <header className="section-head">
        <div>
          <span className="eyebrow">arquivo</span>
          <h1>itens arquivados</h1>
        </div>
      </header>
      <div className="archive-list">
        {archive?.itens.map((item) => (
          <article className="archive-item" key={item.id}>
            <div>
              <span className="eyebrow">{label(item.entidade)}</span>
              <h2>{item.titulo}</h2>
              {item.projeto_titulo && <p>projeto / {item.projeto_titulo}</p>}
              <time>{new Date(item.arquivado_em).toLocaleString('pt-BR')}</time>
            </div>
            {item.entidade === 'desconhecido' ? (
              <small>item legado sem metadados de restauração</small>
            ) : (
              <button className="btn btn--quiet" type="button" onClick={() => void restore(item)}>
                <ArchiveRestore size={14} /> restaurar
              </button>
            )}
          </article>
        ))}
        {archive && archive.itens.length === 0 && <p className="empty">nenhum item arquivado</p>}
        {!archive && <p className="loading">carregando arquivo...</p>}
      </div>
    </section>
  )
}

function label(entity: ArchivedItem['entidade']) {
  if (entity === 'projeto') return 'projeto'
  if (entity === 'tarefa') return 'tarefa'
  if (entity === 'ideia') return 'ideia'
  return 'item'
}
