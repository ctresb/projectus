import { useCallback, useState, type CSSProperties } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '../../components/ui'
import { ColorPicker } from '../../components/ColorPicker'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { NewTagRow, TagPicker } from '../../components/TagPicker'
import { api } from '../../lib/api'
import type { ColorChoice, Project, ProjectCard, Tag } from '../../lib/types'
import { markdownBody } from '../../lib/markdown'
import { useT } from '../../i18n'
import { MarkdownField } from './components/BoardEditorFields'
import { useEditModalForm } from './useEditModalForm'
import { EditFormActions } from './EditFormActions'
import './tags-catalog.css'

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
  const [cor, setCor] = useState(card.cor)
  const [tags, setTags] = useState(card.tags)
  const [taskTags, setTaskTags] = useState(project.tags_disponiveis)

  const { markdown, setMarkdown, markdownLoaded, change } = useEditModalForm<{ dados: Project; markdown: string }>({
    aberto,
    documentKey: project.id,
    save: (markdown) =>
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
    loadMarkdown: () => api.project(project.id).then((doc) => markdownBody(doc.markdown)),
    resetFields: () => {
      setTitulo(project.titulo)
      setGithub(project.github_url)
      setCor(card.cor)
      setTags(card.tags)
      setTaskTags(project.tags_disponiveis)
    },
    validate: useCallback(() => {
      if (!titulo.trim()) {
        onError(t('edit_project.title_required'))
        return false
      }
      if (!github.trim()) {
        onError(t('edit_project.github_required'))
        return false
      }
      return true
    }, [titulo, github, onError, t]),
    onClose,
    resetKeys: [aberto, project.id],
  })

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
            <a
              className="icon-btn"
              href={github}
              rel="noreferrer"
              target="_blank"
              aria-label={t('edit_project.aria_open_repo')}
            >
              <ExternalLink size={16} />
            </a>
          </span>
        </label>
        <span className="field-label">{t('edit_project.label_color')}</span>
        <ColorPicker
          cores={cores}
          value={cor}
          onChange={(value) => change(() => setCor(value))}
          label={t('edit_project.label_color_aria')}
        />
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
        <EditFormActions entidade={t('project_detail.entity_project')} onArchive={onArchive} />
      </div>
    </Modal>
  )
}
