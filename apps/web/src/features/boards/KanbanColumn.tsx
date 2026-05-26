import { Fragment } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion } from 'motion/react'
import type { Column, EntityCard, Tag } from '../../lib/types'
import { EASE } from '../../lib/motion'
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
  let availableIndex = 0

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
        <div className="column__list">
          {cards.map((card) => {
            const before = card.id !== activeId && dropIndex === availableIndex
            if (card.id !== activeId) availableIndex += 1
            return (
              <Fragment key={card.id}>
                {before && <DropIndicator />}
                <SortableKanbanCard card={card} tags={tags} onOpen={() => onOpen(card)} />
              </Fragment>
            )
          })}
          {dropIndex === availableIndex && <DropIndicator />}
          {cards.length === 0 && dropIndex === null && <p className="column__empty">{vazio}</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function DropIndicator() {
  return (
    <motion.div
      aria-hidden
      className="column__drop-indicator"
      initial={{ opacity: 0, scaleX: 0.9 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: EASE }}
    >
      <span />
    </motion.div>
  )
}
