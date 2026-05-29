import { useRef, type RefObject } from 'react'
import type { Column, EntityCard } from '../../lib/types'
import {
  findPlacementAtPoint,
  projectPlacement,
  type MeasuredCard,
  type MeasuredColumn,
  type Point,
} from './kanbanPlacement'
import type { DragSession } from './useDragSession'

type ScrollState = { viewport: HTMLElement | null; speed: number; frame: number | null }

type UseKanbanScrollOptions<T extends EntityCard> = {
  boardRef: RefObject<HTMLDivElement | null>
  sessionRef: RefObject<DragSession | null>
  pointerRef: RefObject<Point | null>
  dragBaseCardsRef: RefObject<T[]>
  colunas: Column[]
  setDragSession: (next: DragSession | null) => void
  setVisualCards: (cards: T[]) => void
}

export function useKanbanScroll<T extends EntityCard>({
  boardRef,
  sessionRef,
  pointerRef,
  dragBaseCardsRef,
  colunas,
  setDragSession,
  setVisualCards,
}: UseKanbanScrollOptions<T>) {
  const scrollRef = useRef<ScrollState>({
    viewport: null,
    speed: 0,
    frame: null,
  })

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
    const speed = topOverflow > 0 ? -scrollSpeed(topOverflow) : bottomOverflow > 0 ? scrollSpeed(bottomOverflow) : 0
    const canScroll =
      speed < 0 ? viewport.scrollTop > 0 : viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1
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

  return { updateAutoScroll, stopAutoScroll }
}

export function placementAtPointer<T extends EntityCard>(
  cards: T[],
  activeId: string,
  point: Point,
  board: HTMLDivElement | null,
) {
  if (!board) return null
  const columns: MeasuredColumn[] = Array.from(board.querySelectorAll<HTMLElement>('[data-column-id]')).map(
    (element) => ({
      id: element.dataset.columnId ?? '',
      rect: element.getBoundingClientRect(),
    }),
  )
  const measuredCards: MeasuredCard[] = Array.from(board.querySelectorAll<HTMLElement>('[data-card-id]')).map(
    (element) => ({
      id: element.dataset.cardId ?? '',
      rect: element.getBoundingClientRect(),
    }),
  )
  return findPlacementAtPoint(cards, activeId, point, columns, measuredCards)
}

function scrollSpeed(overflow: number) {
  return Math.min(20, Math.max(3, Math.round(overflow * 0.2)))
}
