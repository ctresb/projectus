import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'motion/react'
import type { Column, EntityCard, Tag } from '../../lib/types'

type Props<T extends EntityCard> = {
  colunas: Column[]
  cards: T[]
  tags: Tag[]
  vazio: string
  onOpen: (card: T) => void
  onMove: (id: string, status: string, indice: number) => Promise<void>
}

export function KanbanBoard<T extends EntityCard>({ colunas, cards, tags, vazio, onOpen, onMove }: Props<T>) {
  const [visualCards, setVisualCards] = useState(cards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!activeId && !committing) setVisualCards(cards)
  }, [activeId, cards, committing])

  const byColumn = useMemo(() => groupCards(visualCards, colunas), [colunas, visualCards])
  const activeCard = activeId ? visualCards.find((card) => card.id === activeId) ?? null : null

  const start = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    const rect = active.rect.current.initial
    if (rect) setOverlayWidth(rect.width)
  }
  const preview = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setVisualCards((current) => placeCard(current, colunas, String(active.id), String(over.id)))
  }
  const cancel = (_event: DragCancelEvent) => {
    setActiveId(null)
    setOverlayWidth(null)
    setVisualCards(cards)
  }
  const finish = ({ active, over }: DragEndEvent) => {
    if (!over) {
      setActiveId(null)
      setOverlayWidth(null)
      setVisualCards(cards)
      return
    }
    const next = placeCard(visualCards, colunas, String(active.id), String(over.id))
    const placement = positionOf(next, String(active.id))
    if (!placement) {
      setActiveId(null)
      setOverlayWidth(null)
      return
    }
    setVisualCards(next)
    setActiveId(null)
    setOverlayWidth(null)
    setCommitting(true)
    void onMove(String(active.id), placement.status, placement.indice).finally(() => setCommitting(false))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={start}
      onDragOver={preview}
      onDragCancel={cancel}
      onDragEnd={finish}
    >
      <div
        className="kanban"
        aria-label="Quadro kanban"
        style={{ '--column-count': colunas.length } as CSSProperties}
      >
        {colunas.map((column) => (
          <ColumnArea
            key={column.id}
            column={column}
            cards={byColumn[column.id] ?? []}
            tags={tags}
            vazio={vazio}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }}>
        {activeCard ? <CardSurface card={activeCard} tags={tags} overlay width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function groupCards<T extends EntityCard>(cards: T[], columns: Column[]) {
  return Object.fromEntries(columns.map((column) => [column.id, cards.filter((card) => card.status === column.id)]))
}

function placeCard<T extends EntityCard>(cards: T[], columns: Column[], activeId: string, overId: string) {
  const moving = cards.find((card) => card.id === activeId)
  if (!moving || activeId === overId) return cards
  const targetStatus = overId.startsWith('coluna:')
    ? overId.slice('coluna:'.length)
    : cards.find((card) => card.id === overId)?.status
  if (!targetStatus) return cards
  const remaining = cards.filter((card) => card.id !== activeId)
  const bucket = remaining.filter((card) => card.status === targetStatus)
  const overIndex = overId.startsWith('coluna:')
    ? bucket.length
    : Math.max(0, bucket.findIndex((card) => card.id === overId))
  bucket.splice(overIndex, 0, { ...moving, status: targetStatus })
  const grouped = Object.fromEntries(
    columns.map((column) => [
      column.id,
      column.id === targetStatus ? bucket : remaining.filter((card) => card.status === column.id),
    ]),
  ) as Record<string, T[]>
  return columns.flatMap((column) => grouped[column.id])
}

function positionOf<T extends EntityCard>(cards: T[], activeId: string) {
  const card = cards.find((candidate) => candidate.id === activeId)
  if (!card) return null
  return {
    status: card.status,
    indice: cards.filter((candidate) => candidate.status === card.status).findIndex((candidate) => candidate.id === activeId),
  }
}

function ColumnArea<T extends EntityCard>({
  column,
  cards,
  tags,
  vazio,
  onOpen,
}: {
  column: Column
  cards: T[]
  tags: Tag[]
  vazio: string
  onOpen: (card: T) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `coluna:${column.id}` })
  return (
    <section className={`column ${isOver ? 'column--over' : ''}`} ref={setNodeRef}>
      <header className="column__head">
        <span className="column__dot" style={{ backgroundColor: column.cor }} />
        <span>{column.titulo}</span>
        <span className="column__count">{String(cards.length).padStart(2, '0')}</span>
      </header>
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="column__list">
          {cards.map((card) => (
            <SortableCard card={card} tags={tags} key={card.id} onOpen={() => onOpen(card)} />
          ))}
          {cards.length === 0 && <p className="column__empty">{vazio}</p>}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard<T extends EntityCard>({
  card,
  tags,
  onOpen,
}: {
  card: T
  tags: Tag[]
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  return (
    <motion.article
      ref={setNodeRef}
      className={`board-card ${isDragging ? 'board-card--dragging' : ''}`}
      style={
        {
          transform: CSS.Transform.toString(transform),
          transition,
          '--card-color': card.cor,
        } as CSSProperties
      }
      whileHover={isDragging ? undefined : { y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onOpen()
      }}
    >
      <CardContent card={card} tags={tags} />
    </motion.article>
  )
}

function CardSurface<T extends EntityCard>({
  card,
  tags,
  overlay,
  width,
}: {
  card: T
  tags: Tag[]
  overlay?: boolean
  width?: number | null
}) {
  return (
    <article
      className={`board-card ${overlay ? 'board-card--overlay' : ''}`}
      style={
        {
          '--card-color': card.cor,
          ...(width ? { width: `${width}px` } : null),
        } as CSSProperties
      }
    >
      <CardContent card={card} tags={tags} />
    </article>
  )
}

function CardContent<T extends EntityCard>({ card, tags }: { card: T; tags: Tag[] }) {
  const project = 'github_url' in card
  return (
    <>
      <div className="board-card__bar" />
      <h3>{card.titulo}</h3>
      {project && <span className="board-card__repo">github / {new URL(card.github_url).pathname.slice(1)}</span>}
      <div className="board-card__tags">
        {card.tags.map((tagId) => {
          const tag = tags.find((candidate) => candidate.id === tagId)
          return tag ? (
            <span style={{ '--tag-color': tag.cor } as CSSProperties} key={tag.id}>
              {tag.titulo}
            </span>
          ) : null
        })}
      </div>
    </>
  )
}
