import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Board, Config, ProjectCard } from '../../lib/types'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { CreateProjectModal } from './CreateModals'
import { KanbanBoard } from './KanbanBoard'
import { useT } from '../../i18n'
import { Button, Container, PageHeader } from '../../components/ui'

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
  const t = useT()
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
      onMessage('ok', t('projects.created'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('projects.fail_create'))
    }
  }

  return (
    <Container>
      <PageHeader
        eyebrow={t('projects.eyebrow')}
        title={t('projects.title')}
        actions={
        <Button variant="primary" onClick={() => openCreator('')} type="button">
          <Plus size={15} /> {t('projects.new_button')} <kbd>⌘N</kbd>
        </Button>
        }
      />
      <KanbanBoard<ProjectCard>
        colunas={config.colunas}
        cards={board.projetos}
        tags={config.tags}
        vazio={t('projects.empty')}
        onOpen={(card) => onOpen(card.id)}
        onMove={async (id, status, indice) => {
          try {
            onBoard(await api.moveProject({ revision: board.revision, id, status, indice }))
          } catch (error) {
            onMessage('erro', error instanceof Error ? error.message : t('projects.fail_move'))
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
    </Container>
  )
}
