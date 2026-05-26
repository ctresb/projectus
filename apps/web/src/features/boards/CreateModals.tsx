import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Modal } from '../../components/Modal'
import { ColorSwatchButton } from '../../components/ColorSwatchButton'
import { NewTagRow, TagPicker } from '../../components/TagPicker'
import type { ColorChoice, Tag } from '../../lib/types'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import type { MarkdownEditorHandle } from '../editor/MarkdownEditor'

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
  const [titulo, setTitulo] = useState('')
  const [github, setGithub] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [cor, setCor] = useState(cores[0]?.valor ?? '#55B9F7')
  const [tags, setTags] = useState<string[]>([])
  const [novasTags, setNovasTags] = useState<Tag[]>([])
  const allTags = [...tagsDisponiveis, ...novasTags]
  const input = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  useEffect(() => {
    if (aberto) {
      setTitulo(tituloInicial)
      setGithub('')
      setMarkdown('')
      setCor(cores[0]?.valor ?? '#55B9F7')
      setTags([])
      setNovasTags([])
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [aberto, cores, tituloInicial])
  return (
    <Modal aberto={aberto} titulo="novo projeto" onClose={onClose} amplo>
      <form
        className="editor-form editor-form--create"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate({ titulo, githubUrl: github, markdown, cor, tags, novasTags })
        }}
      >
        <label>
          título
          <input
            ref={input}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            onKeyDown={(event) => focusDescription(event, editor)}
            required
          />
        </label>
        <div className="editor-form__markdown">
          <span>descrição</span>
          <DeferredMarkdownEditor ref={editor} documentKey="novo-projeto" markdown={markdown} onChange={setMarkdown} />
        </div>
        <label>
          repositório GitHub
          <input
            type="url"
            placeholder="https://github.com/voce/projeto"
            value={github}
            onChange={(event) => setGithub(event.target.value)}
            required
          />
        </label>
        <div className="inline-options">
          <div>
            <span className="field-label">cor</span>
            <ColorSwatchButton cores={cores} value={cor} onChange={setCor} />
          </div>
          <div>
            <span className="field-label">tags</span>
            <TagPicker disponiveis={allTags} value={tags} onChange={setTags} />
            <NewTagRow
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
            cancelar
          </button>
          <button className="btn btn--primary" type="submit">
            criar projeto
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
  const [titulo, setTitulo] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [cor, setCor] = useState(cores[0]?.valor ?? '#55B9F7')
  const [tags, setTags] = useState<string[]>([])
  const [novasTags, setNovasTags] = useState<Tag[]>([])
  const input = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const allTags = [...tagsDisponiveis, ...novasTags]
  useEffect(() => {
    if (aberto) {
      setTitulo(tituloInicial)
      setMarkdown('')
      setCor(cores[0]?.valor ?? '#55B9F7')
      setTags([])
      setNovasTags([])
      requestAnimationFrame(() => input.current?.focus())
    }
  }, [aberto, cores, tituloInicial])
  return (
    <Modal aberto={aberto} titulo="nova tarefa" onClose={onClose} amplo>
      <form
        className="editor-form editor-form--create"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate({ titulo, markdown, cor, tags, novasTags })
        }}
      >
        <label>
          título
          <input
            ref={input}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            onKeyDown={(event) => focusDescription(event, editor)}
            required
          />
        </label>
        <div className="editor-form__markdown">
          <span>descrição</span>
          <DeferredMarkdownEditor ref={editor} documentKey="nova-tarefa" markdown={markdown} onChange={setMarkdown} />
        </div>
        <div className="inline-options">
          <div>
            <span className="field-label">cor</span>
            <ColorSwatchButton cores={cores} value={cor} onChange={setCor} />
          </div>
          <div>
            <span className="field-label">tags da tarefa</span>
            <TagPicker disponiveis={allTags} value={tags} onChange={setTags} />
            <NewTagRow
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
            cancelar
          </button>
          <button className="btn btn--primary" type="submit">
            criar tarefa
          </button>
        </footer>
      </form>
    </Modal>
  )
}
