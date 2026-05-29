import type { CSSProperties } from 'react'
import { Archive, ArrowRight, FileText, FolderKanban, Map, SquareCheckBig, StickyNote } from 'lucide-react'
import { cx } from '../../../lib/classnames'
import { useT } from '../../../i18n'
import type { GlobalSearchEntry, GlobalSearchKind } from '../types'

const ICONS: Record<GlobalSearchKind, typeof FolderKanban> = {
  project: FolderKanban,
  task: SquareCheckBig,
  idea: StickyNote,
  archive: Archive,
  screen: Map,
}

type ResultCardProps = {
  id: string
  entry: GlobalSearchEntry
  active: boolean
  onActive: () => void
  onSelect: () => void
}

export function ResultCard({ id, entry, active, onActive, onSelect }: ResultCardProps) {
  const t = useT()
  const Icon = ICONS[entry.kind] ?? FileText
  const visibleTags = entry.tags?.slice(0, 4) ?? []
  const extraTags = Math.max(0, (entry.tags?.length ?? 0) - visibleTags.length)

  return (
    <button
      id={id}
      role="option"
      type="button"
      aria-selected={active}
      className={cx('global-search-card', active && 'global-search-card--active')}
      onClick={onSelect}
      onFocus={onActive}
      onMouseEnter={onActive}
    >
      <span className="global-search-card__bar" style={{ backgroundColor: entry.color ?? 'var(--accent)' }} />
      <span className="global-search-card__body">
        <span className="global-search-card__meta">
          <span>{t(`search.kind.${entry.kind}`)}</span>
          <span>/</span>
          <span>{entry.location}</span>
        </span>
        <span className="global-search-card__title">
          <Icon size={15} />
          <strong>{entry.title}</strong>
        </span>
        {entry.description && <span className="global-search-card__description">{entry.description}</span>}
        {visibleTags.length > 0 && (
          <span className="global-search-card__tags">
            {visibleTags.map((tag) => (
              <span style={{ '--tag-color': tag.color } as CSSProperties} key={tag.id}>
                {tag.title}
              </span>
            ))}
            {extraTags > 0 && <span>+{extraTags}</span>}
          </span>
        )}
      </span>
      <span className="global-search-card__jump" aria-hidden>
        <ArrowRight size={15} />
      </span>
    </button>
  )
}
