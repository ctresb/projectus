import { DragOverlay } from '@dnd-kit/core'
import type { EntityCard, Tag } from '../../lib/types'
import { EASE_CSS } from '../../lib/motion'
import { KanbanCardOverlay } from './KanbanCard'

export function KanbanDragOverlay<T extends EntityCard>({
  card,
  tags,
  width,
}: {
  card: T | null
  tags: Tag[]
  width: number | null
}) {
  return (
    <DragOverlay dropAnimation={{ duration: 160, easing: EASE_CSS }}>
      {card ? <KanbanCardOverlay card={card} tags={tags} width={width} /> : null}
    </DragOverlay>
  )
}
