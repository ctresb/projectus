import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Pencil, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, DocumentResponse, Project, ProjectCard, TaskCard } from '../../lib/types'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { CreateTaskModal } from './CreateModals'
import { EditProjectModal, EditTaskModal } from './EditModals'
import { KanbanBoard } from './KanbanBoard'

export function ProjectDetail({
  id,
  card,
  config,
  onBack,
  onRefresh,
  onMessage,
}: {
  id: string
  card: ProjectCard
  config: Config
  onBack: () => void
  onRefresh: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [document, setDocument] = useState<DocumentResponse<Project> | null>(null)
  const [creating, setCreating] = useState(false)
  const [initialTitle, setInitialTitle] = useState('')
  const [editProject, setEditProject] = useState(false)
  const [taskOpen, setTaskOpen] = useState<TaskCard | null>(null)

  const load = useCallback(async () => {
    try {
      setDocument(await api.project(id))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'projeto não encontrado')
    }
  }, [id, onMessage])

  useEffect(() => {
    void load()
  }, [load])

  const openCreator = useCallback((title: string) => {
    setInitialTitle(title)
    setCreating(true)
  }, [])
  useQuickCreate({ ativo: Boolean(document) && !creating && !editProject && !taskOpen, onNovo: openCreator })

  if (!document) return <p className="loading">carregando projeto...</p>
  const project = document.dados

  return (
    <section className="workspace">
      <header className="detail-head">
        <button type="button" className="back" onClick={onBack}>
          <ArrowLeft size={14} /> projetos
        </button>
        <div className="detail-head__title">
          <span className="eyebrow">projeto</span>
          <h1>{project.titulo}</h1>
          <a href={project.github_url} target="_blank" rel="noreferrer">
            {project.github_url.replace('https://github.com/', 'github / ')} <ExternalLink size={13} />
          </a>
        </div>
        <div className="detail-head__actions">
          <button className="btn btn--quiet" type="button" onClick={() => setEditProject(true)}>
            <Pencil size={14} /> editar
          </button>
          <button className="btn btn--primary" type="button" onClick={() => openCreator('')}>
            <Plus size={15} /> nova tarefa <kbd>⌘N</kbd>
          </button>
        </div>
      </header>
      <KanbanBoard<TaskCard>
        colunas={project.colunas}
        cards={project.tarefas}
        tags={project.tags_disponiveis}
        vazio="nenhuma tarefa"
        onOpen={setTaskOpen}
        onMove={async (taskId, status, indice) => {
          try {
            setDocument({ ...document, dados: await api.moveTask(id, { revision: project.revision, id: taskId, status, indice }) })
          } catch (error) {
            onMessage('erro', error instanceof Error ? error.message : 'não foi possível mover a tarefa')
            await load()
          }
        }}
      />
      <CreateTaskModal
        aberto={creating}
        tituloInicial={initialTitle}
        tagsDisponiveis={project.tags_disponiveis}
        cores={config.cores}
        onClose={() => setCreating(false)}
        onCreate={async (input) => {
          try {
            const updated = await api.createTask(id, {
              revision: project.revision,
              titulo: input.titulo,
              markdown: input.markdown,
              cor: input.cor,
              tags: input.tags,
              novas_tags: input.novasTags,
            })
            setDocument({ ...document, dados: updated.dados })
            setCreating(false)
            onMessage('ok', 'tarefa criada')
          } catch (error) {
            onMessage('erro', error instanceof Error ? error.message : 'falha ao criar tarefa')
          }
        }}
      />
      <EditProjectModal
        aberto={editProject}
        project={project}
        card={card}
        cores={config.cores}
        tagsDisponiveis={config.tags}
        onClose={() => setEditProject(false)}
        onSaved={(updated) => {
          setDocument(updated)
          void onRefresh()
        }}
        onArchive={async () => {
          try {
            const fresh = await api.bootstrap()
            await api.archiveProject(project.id, fresh.board.revision)
            setEditProject(false)
            await onRefresh()
            onBack()
            onMessage('ok', 'projeto movido para Arquivo')
          } catch (error) {
            onMessage('erro', error instanceof Error ? error.message : 'não foi possível arquivar')
          }
        }}
        onError={(text) => onMessage('erro', text)}
      />
      {taskOpen && (
        <EditTaskModal
          aberto
          project={project}
          task={taskOpen}
          cores={config.cores}
          onClose={() => setTaskOpen(null)}
          onSaved={(updated) => {
            setDocument({ ...document, dados: updated })
            setTaskOpen(updated.tarefas.find((item) => item.id === taskOpen.id) ?? null)
          }}
          onArchive={async () => {
            try {
              await api.archiveTask(project.id, taskOpen.id, project.revision)
              await load()
              setTaskOpen(null)
              onMessage('ok', 'tarefa movida para Arquivo')
            } catch (error) {
              onMessage('erro', error instanceof Error ? error.message : 'não foi possível arquivar')
            }
          }}
          onError={(text) => onMessage('erro', text)}
        />
      )}
    </section>
  )
}
