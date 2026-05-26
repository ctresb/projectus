import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column, EntityCard, Tag } from '../../lib/types'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { columnDropId } from './kanbanPlacement'
import { SortableKanbanCard } from './KanbanCard'

export function KanbanColumn<T extends EntityCard>({
  column,
  cards,
  tags,
  vazio,
  activeId,
  dropIndex,
  onOpen,
}: {
  column: Column
  cards: T[]
  tags: Tag[]
  vazio: string
  activeId: string | null
  dropIndex: number | null
  onOpen: (card: T) => void
}) {
  const { setNodeRef } = useDroppable({ id: columnDropId(column.id), data: { tipo: 'coluna', status: column.id } })

  return (
    <section
      className={`column ${dropIndex !== null ? 'column--eligible' : ''}`}
      ref={setNodeRef}
      data-column-id={column.id}
    >
      <header className="column__head">
        <span className="column__dot" style={{ backgroundColor: column.cor }} />
        <span>{column.titulo}</span>
        <span className="column__count">{String(cards.length).padStart(2, '0')}</span>
      </header>
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <SquareScrollArea className="column__list" columnId={column.id}>
          {cards.map((card) => (
            <SortableKanbanCard
              card={card}
              tags={tags}
              dropTarget={dropIndex !== null && card.id === activeId}
              key={card.id}
              onOpen={() => onOpen(card)}
            />
          ))}
          {cards.length === 0 && dropIndex === null && <p className="column__empty">{vazio}</p>}
        </SquareScrollArea>
      </SortableContext>
    </section>
  )
}
