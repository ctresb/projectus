import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Board, Config, ProjectCard } from '../../lib/types'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { CreateProjectModal } from './CreateModals'
import { KanbanBoard } from './KanbanBoard'

export function ProjectsView({
  config,
  board,
  onBoard,
  onOpen,
  onRefresh,
  onMessage,
}: {
  config: Config
  board: Board
  onBoard: (board: Board) => void
  onOpen: (id: string) => void
  onRefresh: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [initialTitle, setInitialTitle] = useState('')
  const openCreator = useCallback((title: string) => {
    setInitialTitle(title)
    setCreating(true)
  }, [])
  useQuickCreate({ ativo: !creating, onNovo: openCreator })

  const create = async (input: {
    titulo: string
    githubUrl: string
    markdown: string
    cor: string
    tags: string[]
    novasTags: import('../../lib/types').Tag[]
  }) => {
    try {
      await api.createProject({
        titulo: input.titulo,
        github_url: input.githubUrl,
        markdown: input.markdown,
        cor: input.cor,
        tags: input.tags,
        novas_tags: input.novasTags,
      })
      setCreating(false)
      await onRefresh()
      onMessage('ok', 'projeto criado')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'falha ao criar projeto')
    }
  }

  return (
    <section className="workspace">
      <header className="section-head">
        <div>
          <span className="eyebrow">projetos</span>
          <h1>seus projetos</h1>
        </div>
        <button className="btn btn--primary" onClick={() => openCreator('')} type="button">
          <Plus size={15} /> novo projeto <kbd>⌘N</kbd>
        </button>
      </header>
      <KanbanBoard<ProjectCard>
        colunas={config.colunas}
        cards={board.projetos}
        tags={config.tags}
        vazio="nenhum projeto"
        onOpen={(card) => onOpen(card.id)}
        onMove={async (id, status, indice) => {
          try {
            onBoard(await api.moveProject({ revision: board.revision, id, status, indice }))
          } catch (error) {
            onMessage('erro', error instanceof Error ? error.message : 'não foi possível mover o projeto')
            await onRefresh()
          }
        }}
      />
      <CreateProjectModal
        aberto={creating}
        tituloInicial={initialTitle}
        tagsDisponiveis={config.tags}
        cores={config.cores}
        onClose={() => setCreating(false)}
        onCreate={create}
      />
    </section>
  )
}
