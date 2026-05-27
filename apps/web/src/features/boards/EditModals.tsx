import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '../../components/ui'
import { ArchiveAction } from '../../components/ArchiveAction'
import { ColorPicker } from '../../components/ColorPicker'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { NewTagRow, TagPicker } from '../../components/TagPicker'
import { api } from '../../lib/api'
import type { ColorChoice, Project, ProjectCard, Tag, TaskCard } from '../../lib/types'
import { markdownBody } from '../../lib/markdown'
import { useDocumentAutosave } from '../../hooks/useDocumentAutosave'
import { useCmdEnterSubmit } from '../../hooks/useCmdEnterSubmit'
import { useT } from '../../i18n'
import { MarkdownField } from './components/BoardEditorFields'

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
  const t = useT()
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
        onError(t('edit_project.title_required'))
        return
      }
      if (!github.trim()) {
        onError(t('edit_project.github_required'))
        return
      }
      if (!dirty) {
        onClose()
        return
      }
      void flush().then(onClose).catch(() => {})
    }, [titulo, github, dirty, flush, onClose, onError, t]),
  )

  return (
    <Modal aberto={aberto} titulo={t('edit_project.title')} onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          {t('edit_project.label_title')}
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <label>
          {t('edit_project.label_github')}
          <span className="input-action">
            <input value={github} onChange={(event) => change(() => setGithub(event.target.value))} />
            <a className="icon-btn" href={github} rel="noreferrer" target="_blank" aria-label={t('edit_project.aria_open_repo')}>
              <ExternalLink size={16} />
            </a>
          </span>
        </label>
        <span className="field-label">{t('edit_project.label_color')}</span>
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} label={t('edit_project.label_color_aria')} />
        <span className="field-label">{t('edit_project.label_tags')}</span>
        <TagPicker disponiveis={tagsDisponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <div className="catalog">
          <span className="field-label">{t('edit_project.label_task_tags')}</span>
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
                  label={t('edit_project.label_tag_color', { titulo: tag.titulo })}
                  onChange={(cor) =>
                    change(() =>
                      setTaskTags(taskTags.map((current) => (current.id === tag.id ? { ...current, cor } : current))),
                    )
                  }
                />
                <button
                  className="catalog-tag-editor__remove"
                  type="button"
                  aria-label={t('edit_project.aria_remove_tag', { titulo: tag.titulo })}
                  onClick={() => change(() => setTaskTags(taskTags.filter((current) => current.id !== tag.id)))}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
            {taskTags.length === 0 && <small>{t('edit_project.empty_task_tags')}</small>}
            </div>
          </SquareScrollArea>
          <NewTagRow cores={cores} onCreate={(tag) => change(() => setTaskTags([...taskTags, tag]))} />
        </div>
        <MarkdownField
          label={t('edit_project.label_description')}
          documentKey={`projeto-${project.id}`}
          markdown={markdown}
          loading={!markdownLoaded}
          loadingLabel={t('edit_project.loading_editor')}
          onChange={(value) => {
            if (value !== markdown) change(() => setMarkdown(value))
          }}
          uploadImage={(file) => api.uploadImage(`/projects/${project.id}/anexos`, file)}
        />
        <footer className="form-actions form-actions--spread">
          <ArchiveAction entidade={t('project_detail.entity_project')} onArchive={onArchive} />
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
  const t = useT()
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
        onError(t('edit_project.title_required'))
        return
      }
      if (!dirty) {
        onClose()
        return
      }
      void flush().then(onClose).catch(() => {})
    }, [titulo, dirty, flush, onClose, onError, t]),
  )

  return (
    <Modal aberto={aberto} titulo={t('edit_task.title')} onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          {t('edit_task.label_title')}
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <span className="field-label">{t('edit_task.label_color')}</span>
        <ColorPicker cores={cores} value={cor} onChange={(value) => change(() => setCor(value))} label={t('edit_task.label_color_aria')} />
        <span className="field-label">{t('edit_task.label_tags')}</span>
        <TagPicker disponiveis={project.tags_disponiveis} value={tags} onChange={(value) => change(() => setTags(value))} />
        <MarkdownField
          label={t('edit_task.label_description')}
          documentKey={`tarefa-${task.id}`}
          markdown={markdown}
          loading={!markdownLoaded}
          loadingLabel={t('edit_task.loading_editor')}
          onChange={(value) => {
            if (value !== markdown) change(() => setMarkdown(value))
          }}
          uploadImage={(file) => api.uploadImage(`/projects/${project.id}/tasks/${task.id}/anexos`, file)}
        />
        <footer className="form-actions form-actions--spread">
          <ArchiveAction entidade={t('project_detail.entity_task')} onArchive={onArchive} />
        </footer>
      </div>
    </Modal>
  )
}
