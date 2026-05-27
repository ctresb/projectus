import { useEffect, useRef, useState } from 'react'
import { api } from '../../../lib/api'
import type { Config, DocumentResponse, IdeaCard } from '../../../lib/types'
import { ColorPicker } from '../../../components/ColorPicker'
import { ArchiveAction } from '../../../components/ArchiveAction'
import { DeferredMarkdownEditor } from '../../editor/DeferredMarkdownEditor'
import type { MarkdownEditorHandle } from '../../editor/MarkdownEditor'
import { markdownBody } from '../../../lib/markdown'
import { useDocumentAutosave } from '../../../hooks/useDocumentAutosave'
import { LoadingState } from '../../../components/ui'
import { useT } from '../../../i18n'

export function IdeaEditor({
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
  onPreview: (change: Partial<Pick<IdeaCard, 'titulo' | 'cor'>>) => void
  onArchive: () => Promise<void>
  onMessage: (type: 'ok' | 'erro', text: string) => void
  autoFocusToken?: number
}) {
  const t = useT()
  const [note, setNote] = useState<DocumentResponse<IdeaCard> | null>(null)
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
    void api.idea(id).then((loaded) => {
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
    save: () => api.updateIdea(note!.dados.id, { revision, titulo: title, markdown, cor: color }),
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

  if (!note) return <LoadingState>{t('ideas.loading_note')}</LoadingState>
  const edit = (action: () => void) => {
    action()
    setDirty(true)
  }
  return (
    <>
      <header className="idea-editor__head">
        <input
          className="idea-title"
          value={title}
          onChange={(event) =>
            edit(() => {
              setTitle(event.target.value)
              onPreview({ titulo: event.target.value })
            })
          }
        />
        <div className="idea-editor__actions">
          <ColorPicker
            cores={cores}
            value={color}
            label={t('ideas.label_color')}
            onChange={(value) =>
              edit(() => {
                setColor(value)
                onPreview({ cor: value })
              })
            }
          />
          <ArchiveAction entidade={t('ideas.entity')} onArchive={onArchive} />
        </div>
      </header>
      <DeferredMarkdownEditor
        ref={editor}
        documentKey={`ideia-${note.dados.id}`}
        markdown={markdown}
        onChange={(value) => {
          if (value !== markdown) edit(() => setMarkdown(value))
        }}
        uploadImage={(file) => api.uploadImage(`/ideas/${note.dados.id}/anexos`, file)}
      />
    </>
  )
}
