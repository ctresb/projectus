import type { Announcements } from '@dnd-kit/core'
import type { Column, EntityCard } from '../../lib/types'
import { localizeColumnTitle, type TFn } from '../../i18n'
import { columnFromDropId } from './kanbanPlacement'

export function createAnnouncements<T extends EntityCard>(cards: T[], columns: Column[], t: TFn): Announcements {
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
