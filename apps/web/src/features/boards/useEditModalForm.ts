import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useDocumentAutosave } from '../../hooks/useDocumentAutosave'
import { useCmdEnterSubmit } from '../../hooks/useCmdEnterSubmit'

type EditModalFormOptions<T> = {
  aberto: boolean
  documentKey: string
  save: (markdown: string) => Promise<T>
  onSaved: (saved: T) => void | Promise<void>
  onError: (message: string) => void
  loadMarkdown: () => Promise<string>
  resetFields: () => void
  validate: () => boolean
  onClose: () => void
  resetKeys: unknown[]
}

type EditModalForm = {
  markdown: string
  setMarkdown: Dispatch<SetStateAction<string>>
  markdownLoaded: boolean
  dirty: boolean
  change: (action: () => void) => void
  flush: () => Promise<void>
}

export function useEditModalForm<T>({
  aberto,
  documentKey,
  save,
  onSaved,
  onError,
  loadMarkdown,
  resetFields,
  validate,
  onClose,
  resetKeys,
}: EditModalFormOptions<T>): EditModalForm {
  const [markdown, setMarkdown] = useState('')
  const [markdownLoaded, setMarkdownLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let cancelled = false
    resetFields()
    setDirty(false)
    setMarkdownLoaded(false)
    void loadMarkdown().then((content) => {
      if (cancelled) return
      setMarkdown(content)
      setMarkdownLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKeys)

  const { flush } = useDocumentAutosave({
    ativo: aberto && markdownLoaded,
    dirty,
    documentKey,
    onStart: () => {
      setDirty(false)
    },
    save: () => save(markdown),
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
      if (!validate()) {
        return
      }
      if (!dirty) {
        onClose()
        return
      }
      void flush()
        .then(onClose)
        .catch(() => {})
    }, [dirty, flush, onClose, validate]),
  )

  return { markdown, setMarkdown, markdownLoaded, dirty, change, flush }
}
