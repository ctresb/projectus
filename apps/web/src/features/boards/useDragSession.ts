import { useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Column, EntityCard } from '../../lib/types'
import {
  COLUMN_DROP_PREFIX,
  hasFastHorizontalIntent,
  placementFromOver,
  positionOf,
  projectPlacement,
  samePlacement,
  stabilizePlacement,
  type Placement,
  type Point,
  type PointerSample,
} from './kanbanPlacement'
import { placementAtPointer, useKanbanScroll } from './useKanbanScroll'

export type DragSession = {
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

type UseDragSessionOptions<T extends EntityCard> = {
  colunas: Column[]
  cards: T[]
  onMove: (id: string, status: string, indice: number) => Promise<void>
}

export function useDragSession<T extends EntityCard>({ colunas, cards, onMove }: UseDragSessionOptions<T>) {
  const [visualCards, setVisualCards] = useState(cards)
  const [session, setSession] = useState<DragSession | null>(null)
  const [committing, setCommitting] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const pointerRef = useRef<Point | null>(null)
  const dragBaseCardsRef = useRef<T[]>(cards)

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

  const { updateAutoScroll, stopAutoScroll } = useKanbanScroll<T>({
    boardRef,
    sessionRef,
    pointerRef,
    dragBaseCardsRef,
    colunas,
    setDragSession,
    setVisualCards,
  })

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
    const target =
      current.pointerDriven && current.startPoint
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

  const activeCard = session ? (visualCards.find((card) => card.id === session.activeId) ?? null) : null

  return {
    visualCards,
    session,
    overlayWidth,
    boardRef,
    activeCard,
    collisionDetection,
    handlers: { start, move, over, cancel, finish },
  }
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
