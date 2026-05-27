import { Plus, Search } from 'lucide-react'
import type { IdeaCard } from '../../../lib/types'
import { IconButton } from '../../../components/ui'
import type { TFn } from '../../../i18n'

export function IdeasList({
  ideas,
  search,
  selected,
  onSearch,
  onSelect,
  onCreate,
  t,
}: {
  ideas: IdeaCard[]
  search: string
  selected: string | null
  onSearch: (value: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  t: TFn
}) {
  return (
    <aside className="ideas-list">
      <header>
        <span className="eyebrow">{t('ideas.eyebrow')}</span>
        <IconButton label={t('ideas.aria_new')} onClick={onCreate}>
          <Plus size={16} />
        </IconButton>
      </header>
      <label className="search">
        <Search size={14} />
        <input placeholder={t('ideas.search_placeholder')} value={search} onChange={(event) => onSearch(event.target.value)} />
      </label>
      <nav>
        {ideas.map((idea) => (
          <button
            key={idea.id}
            className={idea.id === selected ? 'idea-link idea-link--active' : 'idea-link'}
            onClick={() => onSelect(idea.id)}
            type="button"
          >
            <span className="idea-link__bar" style={{ backgroundColor: idea.cor }} />
            <span className="idea-link__title">{idea.titulo}</span>
          </button>
        ))}
        {ideas.length === 0 && <small>{t('ideas.list_empty')}</small>}
      </nav>
    </aside>
  )
}
