import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '../../components/Modal'
import { ArchiveAction } from '../../components/ArchiveAction'
import { ColorPicker } from '../../components/ColorPicker'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { NewTagRow, TagPicker } from '../../components/TagPicker'
import { api } from '../../lib/api'
import type { ColorChoice, Project, ProjectCard, Tag, TaskCard } from '../../lib/types'
import { markdownBody } from '../../lib/markdown'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import { useDocumentAutosave } from '../../hooks/useDocumentAutosave'
import { useCmdEnterSubmit } from '../../hooks/useCmdEnterSubmit'

export function EditProjectModal({
  aberto,
  project,
  card,
  cores,
  tagsDisponiveis,
  onClose,
  onSaved,
  onArchive,
  onError,
}: {
  aberto: boolean
  project: Project
  card: ProjectCard
  cores: ColorChoice[]
  tagsDisponiveis: Tag[]
  onClose: () => void
  onSaved: (document: { dados: Project; markdown: string }) => void
  onArchive: () => Promise<void>
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

  useEffect(() => {
    if (!aberto) return
    let cancelled = false
    setTitulo(project.titulo)
    setGithub(project.github_url)
    setCor(card.cor)
    setTags(card.tags)
    setTaskTags(project.tags_disponiveis)
    setDirty(false)
    setMarkdownLoaded(false)
    void api.project(project.id).then((doc) => {
      if (cancelled) return
      setMarkdown(markdownBody(doc.markdown))
      setMarkdownLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [aberto, project.id])

  const { flush } = useDocumentAutosave({
    ativo: aberto && markdownLoaded,
    dirty,
    documentKey: project.id,
    onStart: () => {
      setDirty(false)
    },
    save: () =>
      api.updateProject(project.id, {
        revision: project.revision,
        titulo,
        github_url: github,
        markdown,
        cor,
        tags,
        tags_disponiveis: taskTags,
      }),
    onSaved,
    onError,
  })

  const change = (action: () => void) => {
    action()
    setDirty(true)
  }

  useCmdEnterSubmit(
    aberto && markdownLoaded,
    useCallback(() => {
      if (!titulo.trim()) {
        onError('título obrigatório')
        return
      }
      if (!github.trim()) {
        onError('repositório GitHub obrigatório')
        return
      }
      if (!dirty) {
        onClose()
        return
      }
      void flush().then(onClose).catch(() => {})
    }, [titulo, github, dirty, flush, onClose, onError]),
  )

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
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} label="Cor do projeto" />
        <span className="field-label">tags</span>
        <TagPicker disponiveis={tagsDisponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <div className="catalog">
          <span className="field-label">tags disponíveis nas tarefas</span>
          <SquareScrollArea className="catalog__tags" viewportClassName="catalog__tags-viewport">
            <div className="catalog__tags-grid">
            {taskTags.map((tag) => (
              <motion.div className="catalog-tag-editor" layout key={tag.id}>
                <span className="tag-choice tag-choice--active" style={{ '--tag-color': tag.cor } as CSSProperties}>
                  {tag.titulo}
                </span>
                <ColorPicker
                  cores={cores}
                  value={tag.cor}
                  label={`Cor da tag ${tag.titulo}`}
                  onChange={(cor) =>
                    change(() =>
                      setTaskTags(taskTags.map((current) => (current.id === tag.id ? { ...current, cor } : current))),
                    )
                  }
                />
                <button
                  className="catalog-tag-editor__remove"
                  type="button"
                  aria-label={`Remover ${tag.titulo}`}
                  onClick={() => change(() => setTaskTags(taskTags.filter((current) => current.id !== tag.id)))}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
            {taskTags.length === 0 && <small>crie tags para organizar tarefas</small>}
            </div>
          </SquareScrollArea>
          <NewTagRow cores={cores} onCreate={(tag) => change(() => setTaskTags([...taskTags, tag]))} />
        </div>
        <div className="editor-form__markdown">
          <span>descrição</span>
          {markdownLoaded ? (
            <DeferredMarkdownEditor
              documentKey={`projeto-${project.id}`}
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
          <ArchiveAction entidade="este projeto" onArchive={onArchive} />
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
  onArchive,
  onError,
}: {
  aberto: boolean
  project: Project
  task: TaskCard
  cores: ColorChoice[]
  onClose: () => void
  onSaved: (updated: Project) => void
  onArchive: () => Promise<void>
  onError: (message: string) => void
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [markdown, setMarkdown] = useState('')
  const [markdownLoaded, setMarkdownLoaded] = useState(false)
  const [cor, setCor] = useState(task.cor)
  const [tags, setTags] = useState(task.tags)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let cancelled = false
    setTitulo(task.titulo)
    setCor(task.cor)
    setTags(task.tags)
    setDirty(false)
    setMarkdownLoaded(false)
    void api.taskMarkdown(project.id, task.id).then(({ markdown: content }) => {
      if (cancelled) return
      setMarkdown(markdownBody(content))
      setMarkdownLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [aberto, project.id, task.id])

  const { flush } = useDocumentAutosave({
    ativo: aberto && markdownLoaded,
    dirty,
    documentKey: task.id,
    onStart: () => {
      setDirty(false)
    },
    save: () => api.updateTask(project.id, task.id, { revision: project.revision, titulo, markdown, cor, tags }),
    onSaved,
    onError,
  })

  const change = (action: () => void) => {
    action()
    setDirty(true)
  }

  useCmdEnterSubmit(
    aberto && markdownLoaded,
    useCallback(() => {
      if (!titulo.trim()) {
        onError('título obrigatório')
        return
      }
      if (!dirty) {
        onClose()
        return
      }
      void flush().then(onClose).catch(() => {})
    }, [titulo, dirty, flush, onClose, onError]),
  )

  return (
    <Modal aberto={aberto} titulo="editar tarefa" onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          título
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <span className="field-label">cor</span>
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} label="Cor da tarefa" />
        <span className="field-label">tags</span>
        <TagPicker disponiveis={project.tags_disponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <div className="editor-form__markdown">
          <span>descrição</span>
          {markdownLoaded ? (
            <DeferredMarkdownEditor
              documentKey={`tarefa-${task.id}`}
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
          <ArchiveAction entidade="esta tarefa" onArchive={onArchive} />
        </footer>
      </div>
    </Modal>
  )
}
