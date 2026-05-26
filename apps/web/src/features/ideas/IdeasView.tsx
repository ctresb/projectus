import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, DocumentResponse, IdeaCard, Ideas } from '../../lib/types'
import { ColorPicker } from '../../components/ColorPicker'
import { ArchiveAction } from '../../components/ArchiveAction'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import { markdownBody } from '../../lib/markdown'

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
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(ideas.notas[0]?.id ?? null)
  const filtered = useMemo(
    () => ideas.notas.filter((note) => note.titulo.toLowerCase().includes(search.toLowerCase())),
    [ideas.notas, search],
  )

  const create = async () => {
    try {
      const created = await api.createIdea({ titulo: 'nova ideia', markdown: '' })
      const next = await api.ideas()
      onIdeas(next)
      setSelected(created.dados.id)
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível criar a ideia')
    }
  }

  const archive = async (id: string) => {
    try {
      const next = await api.deleteIdea(id, ideas.revision)
      onIdeas(next)
      setSelected(next.notas[0]?.id ?? null)
      onMessage('ok', 'ideia arquivada na lixeira local')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível arquivar a ideia')
    }
  }

  return (
    <section className="ideas">
      <aside className="ideas-list">
        <header>
          <span className="eyebrow">ideias</span>
          <button className="icon-btn" type="button" aria-label="Nova ideia" onClick={() => void create()}>
            <Plus size={16} />
          </button>
        </header>
        <label className="search">
          <Search size={14} />
          <input placeholder="buscar nota" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <nav>
          {filtered.map((idea) => (
            <button
              key={idea.id}
              className={idea.id === selected ? 'idea-link idea-link--active' : 'idea-link'}
              onClick={() => setSelected(idea.id)}
              type="button"
            >
              <span style={{ backgroundColor: idea.cor }} />
              {idea.titulo}
            </button>
          ))}
          {filtered.length === 0 && <small>nenhuma nota</small>}
        </nav>
      </aside>
      <main className="idea-editor">
        {selected ? (
          <IdeaEditor
            id={selected}
            revision={ideas.revision}
            cores={config.cores}
            onSaved={async () => onIdeas(await api.ideas())}
            onArchive={() => archive(selected)}
            onMessage={onMessage}
          />
        ) : (
          <div className="empty">
            <p>nenhuma ideia ainda</p>
            <button className="btn btn--primary" type="button" onClick={() => void create()}>
              <Plus size={15} /> nova ideia
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
  onArchive,
  onMessage,
}: {
  id: string
  revision: number
  cores: Config['cores']
  onSaved: () => Promise<void>
  onArchive: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [note, setNote] = useState<DocumentResponse<IdeaCard> | null>(null)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [color, setColor] = useState('#55B9F7')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState('salvo localmente')
  const currentId = useRef(id)

  useEffect(() => {
    currentId.current = id
    void api.idea(id).then((loaded) => {
      if (currentId.current !== id) return
      setNote(loaded)
      setTitle(loaded.dados.titulo)
      setMarkdown(markdownBody(loaded.markdown))
      setColor(loaded.dados.cor)
      setDirty(false)
    })
  }, [id])

  useEffect(() => {
    if (!dirty || !note) return
    setSaved('salvando...')
    const timer = window.setTimeout(() => {
      setDirty(false)
      void api
        .updateIdea(note.dados.id, { revision, titulo: title, markdown, cor: color })
        .then(async (updated) => {
          setNote(updated)
          setSaved('salvo localmente')
          await onSaved()
        })
        .catch((error: Error) => {
          setSaved('não salvo')
          onMessage('erro', error.message)
        })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [color, dirty, markdown, note, onMessage, onSaved, revision, title])

  if (!note) return <p className="loading">carregando nota...</p>
  const edit = (action: () => void) => {
    action()
    setDirty(true)
  }
  return (
    <>
      <header className="idea-editor__head">
        <input className="idea-title" value={title} onChange={(event) => edit(() => setTitle(event.target.value))} />
        <span className="save-state">{saved}</span>
        <ColorPicker cores={cores} value={color} onChange={(value) => edit(() => setColor(value))} />
        <ArchiveAction entidade="esta ideia" onArchive={onArchive} />
      </header>
      <DeferredMarkdownEditor
        markdown={markdown}
        onChange={(value) => {
          if (value !== markdown) edit(() => setMarkdown(value))
        }}
        uploadImage={(file) => api.uploadImage(`/ideas/${note.dados.id}/anexos`, file)}
      />
    </>
  )
}
