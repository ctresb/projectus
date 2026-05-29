import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Modal } from '../../components/ui'
import type { ColorChoice, Tag } from '../../lib/types'
import { FALLBACK_COLOR, randomPaletteColor } from '../../lib/colors'
import type { MarkdownEditorHandle } from '../editor/MarkdownEditor'
import { useCmdEnterSubmit } from '../../hooks/useCmdEnterSubmit'
import { useT } from '../../i18n'
import { BoardEditorForm, ColorAndTagsFields, EditorActions, MarkdownField } from './components/BoardEditorFields'
import './tags-catalog.css'

function focusDescription(event: KeyboardEvent<HTMLInputElement>, editor: RefObject<MarkdownEditorHandle | null>) {
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  editor.current?.focus()
}

export function CreateProjectModal({
  aberto,
  tituloInicial,
  tagsDisponiveis,
  cores,
  onClose,
  onCreate,
}: {
  aberto: boolean
  tituloInicial: string
  tagsDisponiveis: Tag[]
  cores: ColorChoice[]
  onClose: () => void
  onCreate: (input: {
    titulo: string
    githubUrl: string
    markdown: string
    cor: string
    tags: string[]
    novasTags: Tag[]
  }) => Promise<void>
}) {
  const t = useT()
  const [titulo, setTitulo] = useState('')
  const [github, setGithub] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [cor, setCor] = useState(FALLBACK_COLOR)
  const [tags, setTags] = useState<string[]>([])
  const [novasTags, setNovasTags] = useState<Tag[]>([])
  const allTags = [...tagsDisponiveis, ...novasTags]
  const input = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (aberto) {
      setTitulo(tituloInicial)
      setGithub('')
      setMarkdown('')
      setCor(randomPaletteColor(cores))
      setTags([])
      setNovasTags([])
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [aberto, cores, tituloInicial])
  useCmdEnterSubmit(
    aberto,
    useCallback(() => {
      formRef.current?.requestSubmit()
    }, []),
  )
  return (
    <Modal aberto={aberto} titulo={t('create_project.title')} onClose={onClose} amplo>
      <BoardEditorForm
        ref={formRef}
        className="editor-form--create"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate({ titulo, githubUrl: github, markdown, cor, tags, novasTags })
        }}
      >
        <label>
          {t('create_project.label_title')}
          <input
            ref={input}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            onKeyDown={(event) => focusDescription(event, editor)}
            required
          />
        </label>
        <MarkdownField
          editorRef={editor}
          label={t('create_project.label_description')}
          documentKey="novo-projeto"
          markdown={markdown}
          onChange={setMarkdown}
        />
        <label>
          {t('create_project.label_github')}
          <input
            type="url"
            placeholder={t('create_project.placeholder_github')}
            value={github}
            onChange={(event) => setGithub(event.target.value)}
            required
          />
        </label>
        <ColorAndTagsFields
          colorLabel={t('create_project.label_color')}
          colorAriaLabel={t('create_project.label_color_aria')}
          tagsLabel={t('create_project.label_tags')}
          cores={cores}
          cor={cor}
          tagsDisponiveis={allTags}
          tags={tags}
          onColorChange={setCor}
          onTagsChange={setTags}
          onCreateTag={(tag) => {
            setNovasTags((current) => [...current, tag])
            setTags((current) => [...current, tag.id])
          }}
        />
        <EditorActions
          cancelLabel={t('create_project.cancel')}
          submitLabel={t('create_project.submit')}
          onCancel={onClose}
        />
      </BoardEditorForm>
    </Modal>
  )
}

export function CreateTaskModal({
  aberto,
  tituloInicial,
  tagsDisponiveis,
  cores,
  onClose,
  onCreate,
}: {
  aberto: boolean
  tituloInicial: string
  tagsDisponiveis: Tag[]
  cores: ColorChoice[]
  onClose: () => void
  onCreate: (input: {
    titulo: string
    markdown: string
    cor: string
    tags: string[]
    novasTags: Tag[]
  }) => Promise<void>
}) {
  const t = useT()
  const [titulo, setTitulo] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [draftKey, setDraftKey] = useState(0)
  const [cor, setCor] = useState(FALLBACK_COLOR)
  const [tags, setTags] = useState<string[]>([])
  const [novasTags, setNovasTags] = useState<Tag[]>([])
  const input = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const allTags = [...tagsDisponiveis, ...novasTags]
  useEffect(() => {
    if (aberto) {
      setTitulo(tituloInicial)
      setMarkdown('')
      setDraftKey((current) => current + 1)
      setCor(randomPaletteColor(cores))
      setTags([])
      setNovasTags([])
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [aberto, cores, tituloInicial])
  useCmdEnterSubmit(
    aberto,
    useCallback(() => {
      formRef.current?.requestSubmit()
    }, []),
  )
  return (
    <Modal aberto={aberto} titulo={t('create_task.title')} onClose={onClose} amplo>
      <BoardEditorForm
        ref={formRef}
        className="editor-form--create"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await onCreate({ titulo, markdown, cor, tags, novasTags })
            setTitulo('')
            setMarkdown('')
            setDraftKey((current) => current + 1)
            setCor(randomPaletteColor(cores))
            setTags([])
            setNovasTags([])
          } catch {
            // The caller already reports the failure; keep the draft intact.
          }
        }}
      >
        <label>
          {t('create_task.label_title')}
          <input
            ref={input}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            onKeyDown={(event) => focusDescription(event, editor)}
            required
          />
        </label>
        <MarkdownField
          editorRef={editor}
          label={t('create_task.label_description')}
          documentKey={`nova-tarefa-${draftKey}`}
          markdown={markdown}
          onChange={setMarkdown}
        />
        <ColorAndTagsFields
          colorLabel={t('create_task.label_color')}
          colorAriaLabel={t('create_task.label_color_aria')}
          tagsLabel={t('create_task.label_tags')}
          cores={cores}
          cor={cor}
          tagsDisponiveis={allTags}
          tags={tags}
          onColorChange={setCor}
          onTagsChange={setTags}
          onCreateTag={(tag) => {
            setNovasTags((current) => [...current, tag])
            setTags((current) => [...current, tag.id])
          }}
        />
        <EditorActions cancelLabel={t('create_task.cancel')} submitLabel={t('create_task.submit')} onCancel={onClose} />
      </BoardEditorForm>
    </Modal>
  )
}
