import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Modal } from '../../components/Modal'
import { ColorPicker } from '../../components/ColorPicker'
import { CommaTagsInput } from '../../components/CommaTagsInput'
import { TagPicker } from '../../components/TagPicker'
import type { ColorChoice, Tag } from '../../lib/types'
import { FALLBACK_COLOR, randomPaletteColor } from '../../lib/colors'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import type { MarkdownEditorHandle } from '../editor/MarkdownEditor'
import { useCmdEnterSubmit } from '../../hooks/useCmdEnterSubmit'
import { useT } from '../../i18n'

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
  onCreate: (input: { titulo: string; githubUrl: string; markdown: string; cor: string; tags: string[]; novasTags: Tag[] }) => Promise<void>
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
      <form
        ref={formRef}
        className="editor-form editor-form--create"
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
        <div className="editor-form__markdown">
          <span>{t('create_project.label_description')}</span>
          <DeferredMarkdownEditor ref={editor} documentKey="novo-projeto" markdown={markdown} onChange={setMarkdown} />
        </div>
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
        <div className="inline-options">
          <div>
            <span className="field-label">{t('create_project.label_color')}</span>
            <ColorPicker cores={cores} value={cor} onChange={setCor} label={t('create_project.label_color_aria')} />
          </div>
          <div>
            <span className="field-label">{t('create_project.label_tags')}</span>
            <TagPicker disponiveis={allTags} value={tags} onChange={setTags} />
            <CommaTagsInput
              cores={cores}
              onCreate={(tag) => {
                setNovasTags((current) => [...current, tag])
                setTags((current) => [...current, tag.id])
              }}
            />
          </div>
        </div>
        <footer className="form-actions">
          <button className="btn btn--quiet" type="button" onClick={onClose}>
            {t('create_project.cancel')}
          </button>
          <button className="btn btn--primary" type="submit">
            {t('create_project.submit')}
          </button>
        </footer>
      </form>
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
  onCreate: (input: { titulo: string; markdown: string; cor: string; tags: string[]; novasTags: Tag[] }) => Promise<void>
}) {
  const t = useT()
  const [titulo, setTitulo] = useState('')
  const [markdown, setMarkdown] = useState('')
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
      <form
        ref={formRef}
        className="editor-form editor-form--create"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate({ titulo, markdown, cor, tags, novasTags })
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
        <div className="editor-form__markdown">
          <span>{t('create_task.label_description')}</span>
          <DeferredMarkdownEditor ref={editor} documentKey="nova-tarefa" markdown={markdown} onChange={setMarkdown} />
        </div>
        <div className="inline-options">
          <div>
            <span className="field-label">{t('create_task.label_color')}</span>
            <ColorPicker cores={cores} value={cor} onChange={setCor} label={t('create_task.label_color_aria')} />
          </div>
          <div>
            <span className="field-label">{t('create_task.label_tags')}</span>
            <TagPicker disponiveis={allTags} value={tags} onChange={setTags} />
            <CommaTagsInput
              cores={cores}
              onCreate={(tag) => {
                setNovasTags((current) => [...current, tag])
                setTags((current) => [...current, tag.id])
              }}
            />
          </div>
        </div>
        <footer className="form-actions">
          <button className="btn btn--quiet" type="button" onClick={onClose}>
            {t('create_task.cancel')}
          </button>
          <button className="btn btn--primary" type="submit">
            {t('create_task.submit')}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
