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
import { localizeColumnTitle, useT, type TFn } from '../../i18n'
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
  cardHeight: number
  grabOffsetY: number
  lastSample: PointerSample | null
  fastHorizontal: boolean
  pointerDriven: boolean
}

export function KanbanBoard<T extends EntityCard>({ colunas, cards, tags, vazio, onOpen, onMove }: Props<T>) {
  const t = useT()
  const screenReaderInstructions = useMemo(() => ({ draggable: t('kanban.instructions') }), [t])
  const [visualCards, setVisualCards] = useState(cards)
  const [session, setSession] = useState<DragSession | null>(null)
  const [committing, setCommitting] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const pointerRef = useRef<Point | null>(null)
  const dragBaseCardsRef = useRef<T[]>(cards)
  const scrollRef = useRef<{ viewport: HTMLElement | null; speed: number; frame: number | null }>({
    viewport: null,
    speed: 0,
    frame: null,
  })
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 130, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!session && !committing) {
      dragBaseCardsRef.current = cards
      setVisualCards(cards)
    }
  }, [cards, committing, session])

  const setDragSession = (next: DragSession | null) => {
    sessionRef.current = next
    setSession(next)
  }
  const byColumn = useMemo(() => groupCards(visualCards, colunas), [colunas, visualCards])
  const activeCard = session ? visualCards.find((card) => card.id === session.activeId) ?? null : null
  const announcements = useMemo<Announcements>(() => createAnnouncements(cards, colunas, t), [cards, colunas, t])
  const collisionDetection = useMemo<CollisionDetection>(
    () => (args) => {
      if (!args.pointerCoordinates) return closestCenter(args)
      pointerRef.current = args.pointerCoordinates
      return pointerWithin({
        ...args,
        droppableContainers: args.droppableContainers.filter(({ id }) => String(id).startsWith(COLUMN_DROP_PREFIX)),
      })
    },
    [],
  )

  const start = ({ active, activatorEvent }: DragStartEvent) => {
    const activeId = String(active.id)
    const origin = positionOf(visualCards, activeId)
    if (!origin) return
    dragBaseCardsRef.current = visualCards
    const point = pointFromEvent(activatorEvent)
    const rect = active.rect.current.initial
    pointerRef.current = point
    setDragSession({
      activeId,
      origin,
      target: null,
      startPoint: point,
      cardHeight: rect?.height ?? 0,
      grabOffsetY: point && rect ? point.y - rect.top : (rect?.height ?? 0) / 2,
      lastSample: point ? { point, timestamp: performance.now() } : null,
      fastHorizontal: false,
      pointerDriven: Boolean(point),
    })
    if (rect) setOverlayWidth(rect.width)
  }

  const move = (event: DragMoveEvent) => {
    const current = sessionRef.current
    if (!current?.pointerDriven || !current.startPoint) return
    const point = pointerRef.current ?? translatedPoint(current.startPoint, event.delta)
    const sample = { point, timestamp: performance.now() }
    const fastHorizontal = hasFastHorizontalIntent(current.lastSample, sample)
    const baseCards = dragBaseCardsRef.current
    const target = stabilizePlacement(
      current.target,
      placementAtPointer(baseCards, current.activeId, point, boardRef.current),
      fastHorizontal,
    )
    setDragSession({ ...current, target, lastSample: sample, fastHorizontal })
    setVisualCards(target ? projectPlacement(baseCards, colunas, current.activeId, target) : baseCards)
    updateAutoScroll(current, point)
  }

  const over = ({ active, over: target }: DragOverEvent) => {
    const current = sessionRef.current
    if (!current || current.pointerDriven || !target) return
    const baseCards = dragBaseCardsRef.current
    const placement = placementFromOver(baseCards, String(active.id), String(target.id))
    setDragSession({ ...current, target: placement })
    setVisualCards(placement ? projectPlacement(baseCards, colunas, current.activeId, placement) : baseCards)
  }

  const cancel = (_event: DragCancelEvent) => {
    stopAutoScroll()
    setDragSession(null)
    pointerRef.current = null
    setOverlayWidth(null)
    setVisualCards(cards)
  }

  const finish = (event: DragEndEvent) => {
    const current = sessionRef.current
    if (!current) return
    const baseCards = dragBaseCardsRef.current
    const target = current.pointerDriven && current.startPoint
      ? placementAtPointer(
          baseCards,
          current.activeId,
          pointerRef.current ?? translatedPoint(current.startPoint, event.delta),
          boardRef.current,
        )
      : event.over
        ? placementFromOver(baseCards, current.activeId, String(event.over.id))
        : null

    stopAutoScroll()
    setDragSession(null)
    pointerRef.current = null
    setOverlayWidth(null)
    if (!target || samePlacement(current.origin, target)) {
      setVisualCards(cards)
      return
    }

    setVisualCards(projectPlacement(baseCards, colunas, current.activeId, target))
    setCommitting(true)
    void onMove(current.activeId, target.status, target.indice)
      .catch(() => setVisualCards(cards))
      .finally(() => setCommitting(false))
  }

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={start}
      onDragMove={move}
      onDragOver={over}
      onDragCancel={cancel}
      onDragEnd={finish}
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
      <DragOverlay dropAnimation={{ duration: 160, easing: EASE_CSS }}>
        {activeCard ? <KanbanCardOverlay card={activeCard} tags={tags} width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  )

  function updateAutoScroll(current: DragSession, point: Point) {
    if (!current.pointerDriven || !boardRef.current) {
      stopAutoScroll()
      return
    }
    const column = Array.from(boardRef.current.querySelectorAll<HTMLElement>('[data-column-id]')).find((element) => {
      const rect = element.getBoundingClientRect()
      return point.x >= rect.left && point.x <= rect.right
    })
    const viewport = column?.querySelector<HTMLElement>('[data-column-scroll]')
    if (!viewport) {
      stopAutoScroll()
      return
    }
    const viewportRect = viewport.getBoundingClientRect()
    const cardTop = point.y - current.grabOffsetY
    const cardBottom = cardTop + current.cardHeight
    const topOverflow = viewportRect.top - cardTop
    const bottomOverflow = cardBottom - viewportRect.bottom
    const speed =
      topOverflow > 0
        ? -scrollSpeed(topOverflow)
        : bottomOverflow > 0
          ? scrollSpeed(bottomOverflow)
          : 0
    const canScroll = speed < 0 ? viewport.scrollTop > 0 : viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1
    if (!speed || !canScroll) {
      stopAutoScroll()
      return
    }
    scrollRef.current.viewport = viewport
    scrollRef.current.speed = speed
    if (scrollRef.current.frame === null) scrollRef.current.frame = requestAnimationFrame(performAutoScroll)
  }

  function performAutoScroll() {
    const state = scrollRef.current
    const current = sessionRef.current
    const point = pointerRef.current
    if (!state.viewport || !state.speed || !current || !point) {
      stopAutoScroll()
      return
    }
    const before = state.viewport.scrollTop
    state.viewport.scrollTop += state.speed
    if (before === state.viewport.scrollTop) {
      stopAutoScroll()
      return
    }
    const baseCards = dragBaseCardsRef.current
    const target = placementAtPointer(baseCards, current.activeId, point, boardRef.current)
    setDragSession({ ...current, target })
    setVisualCards(target ? projectPlacement(baseCards, colunas, current.activeId, target) : baseCards)
    state.frame = requestAnimationFrame(performAutoScroll)
  }

  function stopAutoScroll() {
    if (scrollRef.current.frame !== null) cancelAnimationFrame(scrollRef.current.frame)
    scrollRef.current = { viewport: null, speed: 0, frame: null }
  }
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

function scrollSpeed(overflow: number) {
  return Math.min(20, Math.max(3, Math.round(overflow * 0.2)))
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

function createAnnouncements<T extends EntityCard>(cards: T[], columns: Column[], t: TFn): Announcements {
  const cardTitle = (id: string) => cards.find((card) => card.id === id)?.titulo ?? t('kanban.fallback_card')
  const destination = (id: string) => {
    const status = columnFromDropId(id) ?? cards.find((card) => card.id === id)?.status
    const titulo = columns.find((column) => column.id === status)?.titulo
    return titulo ? localizeColumnTitle(titulo, t) : t('kanban.fallback_board')
  }
  return {
    onDragStart({ active }) {
      return t('kanban.announce_start', { card: cardTitle(String(active.id)) })
    },
    onDragOver({ active, over }) {
      return over
        ? t('kanban.announce_over', { card: cardTitle(String(active.id)), coluna: destination(String(over.id)) })
        : t('kanban.announce_invalid', { card: cardTitle(String(active.id)) })
    },
    onDragEnd({ active, over }) {
      return over
        ? t('kanban.announce_end', { card: cardTitle(String(active.id)), coluna: destination(String(over.id)) })
        : t('kanban.announce_cancel', { card: cardTitle(String(active.id)) })
    },
    onDragCancel({ active }) {
      return t('kanban.announce_cancel', { card: cardTitle(String(active.id)) })
    },
  }
}
