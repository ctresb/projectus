import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, Ideas } from '../../lib/types'
import { useT } from '../../i18n'
import { Button, EmptyState } from '../../components/ui'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import { IdeaEditor } from './components/IdeaEditor'
import { IdeasList } from './components/IdeasList'
import { useIdeasNavigation } from './useIdeasNavigation'
import { useQuickIdea } from './useQuickIdea'
import './ideas.css'

export function IdeasView({
  config,
  ideas,
  navigationRequest,
  onIdeas,
  onMessage,
}: {
  config: Config
  ideas: Ideas
  navigationRequest?: { id: string; token: number } | null
  onIdeas: (ideas: Ideas) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(ideas.notas[0]?.id ?? null)
  const [focusIdeaId, setFocusIdeaId] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const filtered = useMemo(
    () => ideas.notas.filter((note) => note.titulo.toLowerCase().includes(search.toLowerCase())),
    [ideas.notas, search],
  )

  const { quickDraft, quickSession, draftEditor, replaceQuickDraft, updateQuickDraftMarkdown, startDraft, selectIdea } =
    useQuickIdea({
      onIdeas,
      onMessage,
      setSearch,
      setSelected,
      setFocusIdeaId,
      setFocusToken,
    })

  useIdeasNavigation({
    navigationRequest,
    notas: ideas.notas,
    quickSession,
    replaceQuickDraft,
    setSearch,
    setFocusIdeaId,
    setFocusToken,
    setSelected,
  })

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
      <IdeasList
        ideas={filtered}
        search={search}
        selected={selected}
        onSearch={setSearch}
        onSelect={selectIdea}
        onCreate={() => startDraft('')}
        t={t}
      />
      <main className="idea-editor">
        {quickDraft ? (
          <>
            <header className="idea-editor__head">
              <input className="idea-title" value={quickDraft.title} readOnly />
            </header>
            <DeferredMarkdownEditor
              ref={draftEditor}
              documentKey={`nova-ideia-${quickDraft.key}`}
              markdown={quickDraft.markdown}
              onChange={updateQuickDraftMarkdown}
            />
          </>
        ) : selected ? (
          <IdeaEditor
            id={selected}
            revision={ideas.revision}
            cores={config.cores}
            autoFocusToken={selected === focusIdeaId ? focusToken : undefined}
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
          <EmptyState>
            <p>{t('ideas.view_empty')}</p>
            <Button variant="primary" type="button" onClick={() => startDraft('')}>
              <Plus size={15} /> {t('ideas.new_button')}
            </Button>
          </EmptyState>
        )}
      </main>
    </section>
  )
}
