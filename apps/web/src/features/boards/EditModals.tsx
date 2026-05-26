import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { ArchiveAction } from '../../components/ArchiveAction'
import { ColorPicker } from '../../components/ColorPicker'
import { NewTagRow, TagPicker } from '../../components/TagPicker'
import { api } from '../../lib/api'
import type { ColorChoice, Project, ProjectCard, Tag, TaskCard } from '../../lib/types'
import { markdownBody } from '../../lib/markdown'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'

export function EditProjectModal({
  aberto,
  project,
  card,
  cores,
  tagsDisponiveis,
  onClose,
  onSaved,
  onDelete,
  onError,
}: {
  aberto: boolean
  project: Project
  card: ProjectCard
  cores: ColorChoice[]
  tagsDisponiveis: Tag[]
  onClose: () => void
  onSaved: (document: { dados: Project; markdown: string }) => void
  onDelete: () => Promise<void>
  onError: (message: string) => void
}) {
  const [titulo, setTitulo] = useState(project.titulo)
  const [github, setGithub] = useState(project.github_url)
  const [markdown, setMarkdown] = useState('')
  const [markdownLoaded, setMarkdownLoaded] = useState(false)
  const [cor, setCor] = useState(card.cor)
  const [tags, setTags] = useState(card.tags)
  const [taskTags, setTaskTags] = useState(project.tags_disponiveis)
  const [dirty, setDirty] = useState(false)
  const [estado, setEstado] = useState('salvo localmente')

  useEffect(() => {
    if (!aberto) return
    setTitulo(project.titulo)
    setGithub(project.github_url)
    setCor(card.cor)
    setTags(card.tags)
    setTaskTags(project.tags_disponiveis)
    setDirty(false)
    setEstado('salvo localmente')
    setMarkdownLoaded(false)
    void api.project(project.id).then((doc) => {
      setMarkdown(markdownBody(doc.markdown))
      setMarkdownLoaded(true)
    })
  }, [aberto, card.cor, card.tags, project.github_url, project.id, project.tags_disponiveis, project.titulo])

  useEffect(() => {
    if (!dirty || !aberto || !markdownLoaded) return
    setEstado('salvando...')
    const timer = window.setTimeout(() => {
      setDirty(false)
      void api
        .updateProject(project.id, {
          revision: project.revision,
          titulo,
          github_url: github,
          markdown,
          cor,
          tags,
          tags_disponiveis: taskTags,
        })
        .then((doc) => {
          setEstado('salvo localmente')
          onSaved(doc)
        })
        .catch((error: Error) => {
          setEstado('não salvo')
          onError(error.message)
        })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [aberto, cor, dirty, github, markdown, markdownLoaded, onError, onSaved, project.id, project.revision, tags, taskTags, titulo])

  const change = (action: () => void) => {
    action()
    setDirty(true)
  }

  return (
    <Modal aberto={aberto} titulo="editar projeto" onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          título
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <label>
          repositório GitHub
          <span className="input-action">
            <input value={github} onChange={(event) => change(() => setGithub(event.target.value))} />
            <a className="icon-btn" href={github} rel="noreferrer" target="_blank" aria-label="Abrir repositório">
              <ExternalLink size={16} />
            </a>
          </span>
        </label>
        <span className="field-label">cor</span>
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} />
        <span className="field-label">tags</span>
        <TagPicker disponiveis={tagsDisponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <div className="catalog">
          <span className="field-label">tags disponíveis nas tarefas</span>
          <div className="catalog__tags">
            {taskTags.map((tag) => (
              <span className="catalog-tag" key={tag.id}>
                {tag.titulo}
                <button
                  type="button"
                  aria-label={`Remover ${tag.titulo}`}
                  onClick={() => change(() => setTaskTags(taskTags.filter((current) => current.id !== tag.id)))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {taskTags.length === 0 && <small>crie tags para organizar tarefas</small>}
          </div>
          <NewTagRow cores={cores} onCreate={(tag) => change(() => setTaskTags([...taskTags, tag]))} />
        </div>
        <div className="editor-form__markdown">
          <span>descrição</span>
          {markdownLoaded ? (
            <DeferredMarkdownEditor
              markdown={markdown}
              onChange={(value) => {
                if (value !== markdown) change(() => setMarkdown(value))
              }}
              uploadImage={(file) => api.uploadImage(`/projects/${project.id}/anexos`, file)}
            />
          ) : (
            <div className="editor-loading">carregando editor...</div>
          )}
        </div>
        <footer className="form-actions form-actions--spread">
          <ArchiveAction entidade="este projeto" onArchive={onDelete} />
          <span className="save-state">{estado}</span>
        </footer>
      </div>
    </Modal>
  )
}

export function EditTaskModal({
  aberto,
  project,
  task,
  cores,
  onClose,
  onSaved,
  onDelete,
  onError,
}: {
  aberto: boolean
  project: Project
  task: TaskCard
  cores: ColorChoice[]
  onClose: () => void
  onSaved: (updated: Project) => void
  onDelete: () => Promise<void>
  onError: (message: string) => void
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [markdown, setMarkdown] = useState('')
  const [markdownLoaded, setMarkdownLoaded] = useState(false)
  const [cor, setCor] = useState(task.cor)
  const [tags, setTags] = useState(task.tags)
  const [dirty, setDirty] = useState(false)
  const [estado, setEstado] = useState('salvo localmente')

  useEffect(() => {
    if (!aberto) return
    setTitulo(task.titulo)
    setCor(task.cor)
    setTags(task.tags)
    setDirty(false)
    setEstado('salvo localmente')
    setMarkdownLoaded(false)
    void api.taskMarkdown(project.id, task.id).then(({ markdown: content }) => {
      setMarkdown(markdownBody(content))
      setMarkdownLoaded(true)
    })
  }, [aberto, project.id, task.cor, task.id, task.tags, task.titulo])

  useEffect(() => {
    if (!dirty || !aberto || !markdownLoaded) return
    setEstado('salvando...')
    const timer = window.setTimeout(() => {
      setDirty(false)
      void api
        .updateTask(project.id, task.id, { revision: project.revision, titulo, markdown, cor, tags })
        .then((updated) => {
          setEstado('salvo localmente')
          onSaved(updated)
        })
        .catch((error: Error) => {
          setEstado('não salvo')
          onError(error.message)
        })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [aberto, cor, dirty, markdown, markdownLoaded, onError, onSaved, project.id, project.revision, tags, task.id, titulo])

  const change = (action: () => void) => {
    action()
    setDirty(true)
  }
  return (
    <Modal aberto={aberto} titulo="editar tarefa" onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          título
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <span className="field-label">cor</span>
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} />
        <span className="field-label">tags</span>
        <TagPicker disponiveis={project.tags_disponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <div className="editor-form__markdown">
          <span>descrição</span>
          {markdownLoaded ? (
            <DeferredMarkdownEditor
              markdown={markdown}
              onChange={(value) => {
                if (value !== markdown) change(() => setMarkdown(value))
              }}
              uploadImage={(file) => api.uploadImage(`/projects/${project.id}/tasks/${task.id}/anexos`, file)}
            />
          ) : (
            <div className="editor-loading">carregando editor...</div>
          )}
        </div>
        <footer className="form-actions form-actions--spread">
          <ArchiveAction entidade="esta tarefa" onArchive={onDelete} />
          <span className="save-state">{estado}</span>
        </footer>
      </div>
    </Modal>
  )
}
