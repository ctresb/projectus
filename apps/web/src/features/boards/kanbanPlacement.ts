import type { Column } from '../../lib/types'

export const COLUMN_DROP_PREFIX = 'coluna:'

export type Point = { x: number; y: number }
export type RectLike = { top: number; right: number; bottom: number; left: number; height: number }
export type Placement = { status: string; indice: number }
export type PointerSample = { point: Point; timestamp: number }
export type MeasuredColumn = { id: string; rect: RectLike }
export type MeasuredCard = { id: string; rect: RectLike }

type PositionedCard = { id: string; status: string }

export function columnDropId(status: string) {
  return `${COLUMN_DROP_PREFIX}${status}`
}

export function columnFromDropId(overId: string) {
  return overId.startsWith(COLUMN_DROP_PREFIX) ? overId.slice(COLUMN_DROP_PREFIX.length) : null
}

export function groupCards<T extends PositionedCard>(cards: T[], columns: Column[]) {
  return Object.fromEntries(
    columns.map((column) => [column.id, cards.filter((card) => card.status === column.id)]),
  ) as Record<string, T[]>
}

export function positionOf<T extends PositionedCard>(cards: T[], activeId: string): Placement | null {
  const card = cards.find((candidate) => candidate.id === activeId)
  if (!card) return null
  return {
    status: card.status,
    indice: cards
      .filter((candidate) => candidate.status === card.status)
      .findIndex((candidate) => candidate.id === activeId),
  }
}

export function samePlacement(first: Placement | null, second: Placement | null) {
  return Boolean(first && second && first.status === second.status && first.indice === second.indice)
}

export function findPlacementAtPoint<T extends PositionedCard>(
  cards: T[],
  activeId: string,
  point: Point,
  columns: MeasuredColumn[],
  measuredCards: MeasuredCard[],
): Placement | null {
  const target = columns.find(({ rect }) => containsPoint(rect, point))
  if (!target) return null

  const cardRects = new Map(measuredCards.map((card) => [card.id, card.rect]))
  const bucket = cards.filter((card) => card.id !== activeId && card.status === target.id)
  const indice = bucket.findIndex((card) => {
    const rect = cardRects.get(card.id)
    return rect ? point.y < rect.top + rect.height / 2 : false
  })

  return { status: target.id, indice: indice < 0 ? bucket.length : indice }
}

export function placementFromOver<T extends PositionedCard>(
  cards: T[],
  activeId: string,
  overId: string,
): Placement | null {
  const targetStatus = columnFromDropId(overId) ?? cards.find((card) => card.id === overId)?.status
  if (!targetStatus) return null

  const bucket = cards.filter((card) => card.id !== activeId && card.status === targetStatus)
  const overIndex = columnFromDropId(overId) ? bucket.length : bucket.findIndex((card) => card.id === overId)
  return { status: targetStatus, indice: overIndex < 0 ? bucket.length : overIndex }
}

export function projectPlacement<T extends PositionedCard>(
  cards: T[],
  columns: Column[],
  activeId: string,
  placement: Placement,
) {
  const moving = cards.find((card) => card.id === activeId)
  if (!moving) return cards
  const remaining = cards.filter((card) => card.id !== activeId)
  const target = remaining.filter((card) => card.status === placement.status)
  target.splice(Math.min(Math.max(placement.indice, 0), target.length), 0, { ...moving, status: placement.status })

  return columns.flatMap((column) =>
    column.id === placement.status ? target : remaining.filter((card) => card.status === column.id),
  )
}

export function hasFastHorizontalIntent(previous: PointerSample | null, current: PointerSample) {
  if (!previous) return false
  const elapsed = Math.max(1, current.timestamp - previous.timestamp)
  const dx = current.point.x - previous.point.x
  const dy = current.point.y - previous.point.y
  return Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.25 && Math.abs(dx) / elapsed >= 0.65
}

export function stabilizePlacement(previous: Placement | null, current: Placement | null, fastHorizontal: boolean) {
  if (!current || !previous || !fastHorizontal || previous.status !== current.status) return current
  return { ...current, indice: previous.indice }
}

function containsPoint(rect: RectLike, point: Point) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}
