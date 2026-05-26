import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Column, EntityCard, Tag } from '../../lib/types'
import { EASE_CSS } from '../../lib/motion'
import { KanbanCardOverlay } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import {
  COLUMN_DROP_PREFIX,
  columnFromDropId,
  findPlacementAtPoint,
  groupCards,
  hasFastHorizontalIntent,
  placementFromOver,
  positionOf,
  projectPlacement,
  samePlacement,
  stabilizePlacement,
  type MeasuredCard,
  type MeasuredColumn,
  type Placement,
  type Point,
  type PointerSample,
} from './kanbanPlacement'

type Props<T extends EntityCard> = {
  colunas: Column[]
  cards: T[]
  tags: Tag[]
  vazio: string
  onOpen: (card: T) => void
  onMove: (id: string, status: string, indice: number) => Promise<void>
}

type DragSession = {
  activeId: string
  origin: Placement
  target: Placement | null
  startPoint: Point | null
  lastSample: PointerSample | null
  fastHorizontal: boolean
  pointerDriven: boolean
}

const smartColumnCollision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args)
  return pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ id }) => String(id).startsWith(COLUMN_DROP_PREFIX)),
  })
}

const screenReaderInstructions = {
  draggable:
    'Para mover um card, pressione espaço. Use as setas para escolher a posição e pressione espaço novamente para soltar. Pressione Escape para cancelar.',
}

export function KanbanBoard<T extends EntityCard>({ colunas, cards, tags, vazio, onOpen, onMove }: Props<T>) {
  const [visualCards, setVisualCards] = useState(cards)
  const [session, setSession] = useState<DragSession | null>(null)
  const [committing, setCommitting] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 130, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!session && !committing) setVisualCards(cards)
  }, [cards, committing, session])

  const setDragSession = (next: DragSession | null) => {
    sessionRef.current = next
    setSession(next)
  }
  const byColumn = useMemo(() => groupCards(visualCards, colunas), [colunas, visualCards])
  const activeCard = session ? visualCards.find((card) => card.id === session.activeId) ?? null : null
  const announcements = useMemo<Announcements>(() => createAnnouncements(cards, colunas), [cards, colunas])

  const start = ({ active, activatorEvent }: DragStartEvent) => {
    const activeId = String(active.id)
    const origin = positionOf(visualCards, activeId)
    if (!origin) return
    const point = pointFromEvent(activatorEvent)
    setDragSession({
      activeId,
      origin,
      target: null,
      startPoint: point,
      lastSample: point ? { point, timestamp: performance.now() } : null,
      fastHorizontal: false,
      pointerDriven: Boolean(point),
    })
    const rect = active.rect.current.initial
    if (rect) setOverlayWidth(rect.width)
  }

  const move = (event: DragMoveEvent) => {
    const current = sessionRef.current
    if (!current?.pointerDriven || !current.startPoint) return
    const point = translatedPoint(current.startPoint, event.delta)
    const sample = { point, timestamp: performance.now() }
    const fastHorizontal = hasFastHorizontalIntent(current.lastSample, sample)
    const target = stabilizePlacement(current.target, placementAtPointer(visualCards, current.activeId, point, boardRef.current), fastHorizontal)
    setDragSession({ ...current, target, lastSample: sample, fastHorizontal })
  }

  const over = ({ active, over: target }: DragOverEvent) => {
    const current = sessionRef.current
    if (!current || current.pointerDriven || !target) return
    setDragSession({ ...current, target: placementFromOver(visualCards, String(active.id), String(target.id)) })
  }

  const cancel = (_event: DragCancelEvent) => {
    setDragSession(null)
    setOverlayWidth(null)
    setVisualCards(cards)
  }

  const finish = (event: DragEndEvent) => {
    const current = sessionRef.current
    if (!current) return
    const target = current.pointerDriven && current.startPoint
      ? placementAtPointer(visualCards, current.activeId, translatedPoint(current.startPoint, event.delta), boardRef.current)
      : event.over
        ? placementFromOver(visualCards, current.activeId, String(event.over.id))
        : null

    setDragSession(null)
    setOverlayWidth(null)
    if (!target || samePlacement(current.origin, target)) {
      setVisualCards(cards)
      return
    }

    setVisualCards(projectPlacement(visualCards, colunas, current.activeId, target))
    setCommitting(true)
    void onMove(current.activeId, target.status, target.indice)
      .catch(() => setVisualCards(cards))
      .finally(() => setCommitting(false))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={smartColumnCollision}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={start}
      onDragMove={move}
      onDragOver={over}
      onDragCancel={cancel}
      onDragEnd={finish}
    >
      <div
        ref={boardRef}
        className="kanban"
        aria-label="Quadro kanban"
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
      <DragOverlay dropAnimation={{ duration: 160, easing: EASE_CSS }}>
        {activeCard ? <KanbanCardOverlay card={activeCard} tags={tags} width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function placementAtPointer<T extends EntityCard>(cards: T[], activeId: string, point: Point, board: HTMLDivElement | null) {
  if (!board) return null
  const columns: MeasuredColumn[] = Array.from(board.querySelectorAll<HTMLElement>('[data-column-id]')).map((element) => ({
    id: element.dataset.columnId ?? '',
    rect: element.getBoundingClientRect(),
  }))
  const measuredCards: MeasuredCard[] = Array.from(board.querySelectorAll<HTMLElement>('[data-card-id]')).map((element) => ({
    id: element.dataset.cardId ?? '',
    rect: element.getBoundingClientRect(),
  }))
  return findPlacementAtPoint(cards, activeId, point, columns, measuredCards)
}

function translatedPoint(point: Point, delta: { x: number; y: number }) {
  return { x: point.x + delta.x, y: point.y + delta.y }
}

function pointFromEvent(event: Event): Point | null {
  if ('clientX' in event && 'clientY' in event) {
    const pointer = event as MouseEvent
    return { x: pointer.clientX, y: pointer.clientY }
  }
  if ('touches' in event) {
    const touches = event as TouchEvent
    const pointer = touches.touches[0] ?? touches.changedTouches[0]
    return pointer ? { x: pointer.clientX, y: pointer.clientY } : null
  }
  return null
}

function createAnnouncements<T extends EntityCard>(cards: T[], columns: Column[]): Announcements {
  const cardTitle = (id: string) => cards.find((card) => card.id === id)?.titulo ?? 'card'
  const destination = (id: string) => {
    const status = columnFromDropId(id) ?? cards.find((card) => card.id === id)?.status
    return columns.find((column) => column.id === status)?.titulo ?? 'quadro'
  }
  return {
    onDragStart({ active }) {
      return `${cardTitle(String(active.id))} selecionado.`
    },
    onDragOver({ active, over }) {
      return over
        ? `${cardTitle(String(active.id))} sobre a coluna ${destination(String(over.id))}.`
        : `${cardTitle(String(active.id))} fora de uma coluna válida.`
    },
    onDragEnd({ active, over }) {
      return over
        ? `${cardTitle(String(active.id))} solto na coluna ${destination(String(over.id))}.`
        : `Movimento de ${cardTitle(String(active.id))} cancelado.`
    },
    onDragCancel({ active }) {
      return `Movimento de ${cardTitle(String(active.id))} cancelado.`
    },
  }
}
