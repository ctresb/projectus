import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, Ideas } from '../../lib/types'
import { useT } from '../../i18n'
import { Button, EmptyState } from '../../components/ui'
import { IdeaEditor } from './components/IdeaEditor'
import { IdeasList } from './components/IdeasList'

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
      <IdeasList
        ideas={filtered}
        search={search}
        selected={selected}
        onSearch={setSearch}
        onSelect={setSelected}
        onCreate={() => void create()}
        t={t}
      />
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
          <EmptyState>
            <p>{t('ideas.view_empty')}</p>
            <Button variant="primary" type="button" onClick={() => void create()}>
              <Plus size={15} /> {t('ideas.new_button')}
            </Button>
          </EmptyState>
        )}
      </main>
    </section>
  )
}
