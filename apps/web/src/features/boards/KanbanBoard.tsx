import { useMemo, type CSSProperties } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Column, EntityCard, Tag } from '../../lib/types'
import { KanbanColumn } from './KanbanColumn'
import { useT } from '../../i18n'
import { groupCards } from './kanbanPlacement'
import { createAnnouncements } from './kanbanAnnouncements'
import { useDragSession } from './useDragSession'
import { KanbanDragOverlay } from './KanbanDragOverlay'
import './boards.css'

type Props<T extends EntityCard> = {
  colunas: Column[]
  cards: T[]
  tags: Tag[]
  vazio: string
  onOpen: (card: T) => void
  onMove: (id: string, status: string, indice: number) => Promise<void>
}

export function KanbanBoard<T extends EntityCard>({ colunas, cards, tags, vazio, onOpen, onMove }: Props<T>) {
  const t = useT()
  const screenReaderInstructions = useMemo(() => ({ draggable: t('kanban.instructions') }), [t])
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 130, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { visualCards, session, overlayWidth, boardRef, activeCard, collisionDetection, handlers } = useDragSession<T>({
    colunas,
    cards,
    onMove,
  })

  const byColumn = useMemo(() => groupCards(visualCards, colunas), [colunas, visualCards])
  const announcements = useMemo<Announcements>(() => createAnnouncements(cards, colunas, t), [cards, colunas, t])

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={handlers.start}
      onDragMove={handlers.move}
      onDragOver={handlers.over}
      onDragCancel={handlers.cancel}
      onDragEnd={handlers.finish}
    >
      <div
        ref={boardRef}
        className={`kanban ${session?.pointerDriven ? 'kanban--dragging' : ''}`}
        aria-label={t('kanban.aria_board')}
        style={{ '--column-count': colunas.length } as CSSProperties}
      >
        {colunas.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={byColumn[column.id] ?? []}
            tags={tags}
            vazio={vazio}
            activeId={session?.activeId ?? null}
            dropIndex={session?.target?.status === column.id ? session.target.indice : null}
            onOpen={onOpen}
          />
        ))}
      </div>
      <KanbanDragOverlay card={activeCard} tags={tags} width={overlayWidth} />
    </DndContext>
  )
}
