import { useCallback, useState } from 'react'
import { Modal } from '../../components/ui'
import { ColorPicker } from '../../components/ColorPicker'
import { TagPicker } from '../../components/TagPicker'
import { api } from '../../lib/api'
import type { ColorChoice, Project, TaskCard } from '../../lib/types'
import { markdownBody } from '../../lib/markdown'
import { useT } from '../../i18n'
import { MarkdownField } from './components/BoardEditorFields'
import { useEditModalForm } from './useEditModalForm'
import { EditFormActions } from './EditFormActions'
import './tags-catalog.css'

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
  const [cor, setCor] = useState(task.cor)
  const [tags, setTags] = useState(task.tags)

  const { markdown, setMarkdown, markdownLoaded, change } = useEditModalForm<Project>({
    aberto,
    documentKey: task.id,
    save: (markdown) =>
      api.updateTask(project.id, task.id, { revision: project.revision, titulo, markdown, cor, tags }),
    onSaved,
    onError,
    loadMarkdown: () => api.taskMarkdown(project.id, task.id).then(({ markdown: content }) => markdownBody(content)),
    resetFields: () => {
      setTitulo(task.titulo)
      setCor(task.cor)
      setTags(task.tags)
    },
    validate: useCallback(() => {
      if (!titulo.trim()) {
        onError(t('edit_project.title_required'))
        return false
      }
      return true
    }, [titulo, onError, t]),
    onClose,
    resetKeys: [aberto, project.id, task.id],
  })

  return (
    <Modal aberto={aberto} titulo={t('edit_task.title')} onClose={onClose} amplo>
      <div className="editor-form">
        <label>
          {t('edit_task.label_title')}
          <input value={titulo} onChange={(event) => change(() => setTitulo(event.target.value))} />
        </label>
        <span className="field-label">{t('edit_task.label_color')}</span>
        <ColorPicker
          cores={cores}
          value={cor}
          onChange={(value) => change(() => setCor(value))}
          label={t('edit_task.label_color_aria')}
        />
        <span className="field-label">{t('edit_task.label_tags')}</span>
        <TagPicker
          disponiveis={project.tags_disponiveis}
          value={tags}
          onChange={(value) => change(() => setTags(value))}
        />
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
        <EditFormActions entidade={t('project_detail.entity_task')} onArchive={onArchive} />
      </div>
    </Modal>
  )
}
