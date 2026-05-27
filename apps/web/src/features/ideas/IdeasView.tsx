import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, DocumentResponse, IdeaCard, Ideas } from '../../lib/types'
import { ColorPicker } from '../../components/ColorPicker'
import { ArchiveAction } from '../../components/ArchiveAction'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import { markdownBody } from '../../lib/markdown'
import { useDocumentAutosave } from '../../hooks/useDocumentAutosave'
import { useT } from '../../i18n'

export function IdeasView({
  config,
  ideas,
  onIdeas,
  onMessage,
}: {
  config: Config
  ideas: Ideas
  onIdeas: (ideas: Ideas) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(ideas.notas[0]?.id ?? null)
  const filtered = useMemo(
    () => ideas.notas.filter((note) => note.titulo.toLowerCase().includes(search.toLowerCase())),
    [ideas.notas, search],
  )

  const create = async () => {
    try {
      const created = await api.createIdea({ titulo: t('ideas.default_title'), markdown: '' })
      const next = await api.ideas()
      onIdeas(next)
      setSelected(created.dados.id)
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('ideas.fail_create'))
    }
  }

  const archive = async (id: string) => {
    try {
      await api.archiveIdea(id, ideas.revision)
      const next = await api.ideas()
      onIdeas(next)
      setSelected(next.notas[0]?.id ?? null)
      onMessage('ok', t('ideas.archived'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('ideas.fail_archive'))
    }
  }

  return (
    <section className="ideas">
      <aside className="ideas-list">
        <header>
          <span className="eyebrow">{t('ideas.eyebrow')}</span>
          <button className="icon-btn" type="button" aria-label={t('ideas.aria_new')} onClick={() => void create()}>
            <Plus size={16} />
          </button>
        </header>
        <label className="search">
          <Search size={14} />
          <input placeholder={t('ideas.search_placeholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <nav>
          {filtered.map((idea) => (
            <button
              key={idea.id}
              className={idea.id === selected ? 'idea-link idea-link--active' : 'idea-link'}
              onClick={() => setSelected(idea.id)}
              type="button"
            >
              <span className="idea-link__bar" style={{ backgroundColor: idea.cor }} />
              <span className="idea-link__title">{idea.titulo}</span>
            </button>
          ))}
          {filtered.length === 0 && <small>{t('ideas.list_empty')}</small>}
        </nav>
      </aside>
      <main className="idea-editor">
        {selected ? (
          <IdeaEditor
            id={selected}
            revision={ideas.revision}
            cores={config.cores}
            onSaved={async () => onIdeas(await api.ideas())}
            onPreview={(change) =>
              onIdeas({
                ...ideas,
                notas: ideas.notas.map((idea) => (idea.id === selected ? { ...idea, ...change } : idea)),
              })
            }
            onArchive={() => archive(selected)}
            onMessage={onMessage}
          />
        ) : (
          <div className="empty">
            <p>{t('ideas.view_empty')}</p>
            <button className="btn btn--primary" type="button" onClick={() => void create()}>
              <Plus size={15} /> {t('ideas.new_button')}
            </button>
          </div>
        )}
      </main>
    </section>
  )
}

function IdeaEditor({
  id,
  revision,
  cores,
  onSaved,
  onPreview,
  onArchive,
  onMessage,
}: {
  id: string
  revision: number
  cores: Config['cores']
  onSaved: () => Promise<void>
  onPreview: (change: Partial<Pick<IdeaCard, 'titulo' | 'cor'>>) => void
  onArchive: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [note, setNote] = useState<DocumentResponse<IdeaCard> | null>(null)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [color, setColor] = useState('#55B9F7')
  const [dirty, setDirty] = useState(false)
  const currentId = useRef(id)

  useEffect(() => {
    currentId.current = id
    setNote(null)
    void api.idea(id).then((loaded) => {
      if (currentId.current !== id) return
      setNote(loaded)
      setTitle(loaded.dados.titulo)
      setMarkdown(markdownBody(loaded.markdown))
      setColor(loaded.dados.cor)
      setDirty(false)
    })
  }, [id])

  useDocumentAutosave({
    ativo: Boolean(note),
    dirty,
    documentKey: id,
    onStart: () => {
      setDirty(false)
    },
    save: () => api.updateIdea(note!.dados.id, { revision, titulo: title, markdown, cor: color }),
    onSaved: async (updated) => {
      if (currentId.current === updated.dados.id) setNote(updated)
      await onSaved()
    },
    onError: (message) => onMessage('erro', message),
  })

  if (!note) return <p className="loading">{t('ideas.loading_note')}</p>
  const edit = (action: () => void) => {
    action()
    setDirty(true)
  }
  return (
    <>
      <header className="idea-editor__head">
        <input
          className="idea-title"
          value={title}
          onChange={(event) =>
            edit(() => {
              setTitle(event.target.value)
              onPreview({ titulo: event.target.value })
            })
          }
        />
        <div className="idea-editor__actions">
          <ColorPicker
            cores={cores}
            value={color}
            label={t('ideas.label_color')}
            onChange={(value) =>
              edit(() => {
                setColor(value)
                onPreview({ cor: value })
              })
            }
          />
          <ArchiveAction entidade={t('ideas.entity')} onArchive={onArchive} />
        </div>
      </header>
      <DeferredMarkdownEditor
        documentKey={`ideia-${note.dados.id}`}
        markdown={markdown}
        onChange={(value) => {
          if (value !== markdown) edit(() => setMarkdown(value))
        }}
        uploadImage={(file) => api.uploadImage(`/ideas/${note.dados.id}/anexos`, file)}
      />
    </>
  )
}
