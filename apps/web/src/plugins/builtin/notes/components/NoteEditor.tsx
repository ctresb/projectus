import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../lib/api'
import { notesApi } from '../notesApi'
import type { Config, DocumentResponse, Note } from '../../../../lib/types'
import { ColorPicker } from '../../../../components/ColorPicker'
import { ArchiveAction } from '../../../../components/ArchiveAction'
import { DeferredMarkdownEditor } from '../../../../features/editor/DeferredMarkdownEditor'
import type { MarkdownEditorHandle } from '../../../../features/editor/MarkdownEditor'
import { markdownBody } from '../../../../lib/markdown'
import { useDocumentAutosave } from '../../../../hooks/useDocumentAutosave'
import { LoadingState } from '../../../../components/ui'
import { useT } from '../../../../i18n'

export function NoteEditor({
  id,
  revision,
  cores,
  onSaved,
  onPreview,
  onArchive,
  onMessage,
  autoFocusToken,
}: {
  id: string
  revision: number
  cores: Config['cores']
  onSaved: () => Promise<void>
  onPreview: (change: Partial<Pick<Note, 'titulo' | 'cor'>>) => void
  onArchive: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
  autoFocusToken?: number
}) {
  const t = useT()
  const [note, setNote] = useState<DocumentResponse<Note> | null>(null)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [color, setColor] = useState('#55B9F7')
  const [dirty, setDirty] = useState(false)
  const currentId = useRef(id)
  const editor = useRef<MarkdownEditorHandle>(null)
  const focusedToken = useRef<number | undefined>(undefined)

  useEffect(() => {
    currentId.current = id
    setNote(null)
    void notesApi.note(id).then((loaded) => {
      if (currentId.current !== id) return
      setNote(loaded)
      setTitle(loaded.dados.titulo)
      setMarkdown(markdownBody(loaded.markdown))
      setColor(loaded.dados.cor)
      setDirty(false)
    })
  }, [id])

  useDocumentAutosave({
    ativo: Boolean(note),
    dirty,
    documentKey: id,
    onStart: () => {
      setDirty(false)
    },
    save: () => notesApi.updateNote(note!.dados.id, { revision, titulo: title, markdown, cor: color }),
    onSaved: async (updated) => {
      if (currentId.current === updated.dados.id) setNote(updated)
      await onSaved()
    },
    onError: (message) => onMessage('erro', message),
  })

  useEffect(() => {
    if (!note || autoFocusToken === undefined || focusedToken.current === autoFocusToken) return
    focusedToken.current = autoFocusToken
    const frame = requestAnimationFrame(() => editor.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocusToken, note])

  if (!note) return <LoadingState>{t('notes.loading_note')}</LoadingState>
  const edit = (action: () => void) => {
    action()
    setDirty(true)
  }
  return (
    <>
      <header className="note-editor__head">
        <input
          className="note-title"
          value={title}
          onChange={(event) =>
            edit(() => {
              setTitle(event.target.value)
              onPreview({ titulo: event.target.value })
            })
          }
        />
        <div className="note-editor__actions">
          <ColorPicker
            cores={cores}
            value={color}
            label={t('notes.label_color')}
            onChange={(value) =>
              edit(() => {
                setColor(value)
                onPreview({ cor: value })
              })
            }
          />
          <ArchiveAction entidade={t('notes.entity')} onArchive={onArchive} />
        </div>
      </header>
      <DeferredMarkdownEditor
        ref={editor}
        documentKey={`nota-${note.dados.id}`}
        markdown={markdown}
        onChange={(value) => {
          if (value !== markdown) edit(() => setMarkdown(value))
        }}
        uploadImage={(file) => api.uploadImage(`/notes/${note.dados.id}/anexos`, file)}
      />
    </>
  )
}
