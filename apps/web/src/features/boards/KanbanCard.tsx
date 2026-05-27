import { motion } from 'motion/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import type { EntityCard, Tag } from '../../lib/types'
import { EASE } from '../../lib/motion'
import { useT } from '../../i18n'

export function SortableKanbanCard<T extends EntityCard>({
  card,
  tags,
  onOpen,
}: {
  card: T
  tags: Tag[]
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const t = useT()

  return (
    <motion.article
      ref={setNodeRef}
      data-card-id={card.id}
      className={`board-card ${isDragging ? 'board-card--source' : ''}`}
      style={
        {
          transform: isDragging ? undefined : CSS.Transform.toString(transform),
          transition: isDragging ? undefined : transition,
          '--card-color': card.cor,
        } as CSSProperties
      }
      layout={!isDragging ? 'position' : false}
      whileHover={isDragging ? undefined : { y: -1 }}
      whileTap={isDragging ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.12, ease: EASE }}
      {...attributes}
      {...listeners}
      aria-label={t('kanban.aria_card', { titulo: card.titulo })}
      onClick={() => {
        if (!isDragging) onOpen()
      }}
    >
      <CardContent card={card} tags={tags} />
    </motion.article>
  )
}

export function KanbanCardOverlay<T extends EntityCard>({
  card,
  tags,
  width,
}: {
  card: T
  tags: Tag[]
  width?: number | null
}) {
  return (
    <article
      className="board-card board-card--overlay"
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
      {card.resumo?.trim() && <p className="board-card__summary">{card.resumo}</p>}
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
