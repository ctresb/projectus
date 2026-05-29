import { Plus, Search } from 'lucide-react'
import type { Note } from '../../../../lib/types'
import { IconButton } from '../../../../components/ui'
import type { TFn } from '../../../../i18n'

export function NotesList({
  notes,
  search,
  selected,
  onSearch,
  onSelect,
  onCreate,
  t,
}: {
  notes: Note[]
  search: string
  selected: string | null
  onSearch: (value: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  t: TFn
}) {
  return (
    <aside className="notes-list">
      <header>
        <span className="eyebrow">{t('notes.eyebrow')}</span>
        <IconButton label={t('notes.aria_new')} onClick={onCreate}>
          <Plus size={16} />
        </IconButton>
      </header>
      <label className="search">
        <Search size={14} />
        <input placeholder={t('notes.search_placeholder')} value={search} onChange={(event) => onSearch(event.target.value)} />
      </label>
      <nav>
        {notes.map((note) => (
          <button
            key={note.id}
            className={note.id === selected ? 'note-link note-link--active' : 'note-link'}
            onClick={() => onSelect(note.id)}
            type="button"
          >
            <span className="note-link__bar" style={{ backgroundColor: note.cor }} />
            <span className="note-link__title">{note.titulo}</span>
          </button>
        ))}
        {notes.length === 0 && <small>{t('notes.list_empty')}</small>}
      </nav>
    </aside>
  )
}
