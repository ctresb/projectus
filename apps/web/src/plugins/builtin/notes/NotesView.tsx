import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { notesApi } from './notesApi'
import type { Config, NotesIndex } from '../../../lib/types'
import { useT } from '../../../i18n'
import { Button, EmptyState } from '../../../components/ui'
import type { MarkdownEditorHandle } from '../../../features/editor/MarkdownEditor'
import { DeferredMarkdownEditor } from '../../../features/editor/DeferredMarkdownEditor'
import { NoteEditor } from './components/NoteEditor'
import { NotesList } from './components/NotesList'

type QuickDraft = {
  key: number
  title: string
  markdown: string
}

const QUICK_CREATE_SETTLE_MS = 160

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export type NotesViewHandle = {
  quickCreate: (initialMarkdown?: string) => void
}

export const NotesView = forwardRef<
  NotesViewHandle,
  {
    config: Config
    notes: NotesIndex
    navigationRequest?: { id: string; token: number } | null
    onNotes: (notes: NotesIndex) => void
    onMessage: (type: 'ok' | 'erro', text: string) => void
  }
>(function NotesView({ config, notes, navigationRequest, onNotes, onMessage }, ref) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(notes.notas[0]?.id ?? null)
  const [quickDraft, setQuickDraft] = useState<QuickDraft | null>(null)
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const quickDraftRef = useRef<QuickDraft | null>(null)
  const quickPersisting = useRef(false)
  const quickSession = useRef(0)
  const handledNavigationToken = useRef<number | null>(null)
  const draftEditor = useRef<MarkdownEditorHandle>(null)
  const filtered = useMemo(
    () => notes.notas.filter((note) => note.titulo.toLowerCase().includes(search.toLowerCase())),
    [notes.notas, search],
  )

  const replaceQuickDraft = useCallback((draft: QuickDraft | null) => {
    quickDraftRef.current = draft
    setQuickDraft(draft)
  }, [])

  const updateQuickDraftMarkdown = useCallback(
    (markdown: string) => {
      const current = quickDraftRef.current
      if (!current) return
      replaceQuickDraft({ ...current, markdown })
    },
    [replaceQuickDraft],
  )

  const persistQuickDraft = useCallback(
    async (session: number) => {
      if (quickPersisting.current) return
      quickPersisting.current = true
      try {
        const firstDraft = quickDraftRef.current
        if (!firstDraft) return

        const defaultTitle = t('notes.default_title')
        let savedTitle = firstDraft.title.trim() || defaultTitle
        let savedMarkdown = firstDraft.markdown
        const created = await notesApi.createNote({ titulo: savedTitle, markdown: savedMarkdown })
        let next = await notesApi.notes()
        onNotes(next)

        if (savedMarkdown.trim()) await wait(QUICK_CREATE_SETTLE_MS)

        while (quickSession.current === session) {
          const latestDraft = quickDraftRef.current
          if (!latestDraft) return

          const latestTitle = latestDraft.title.trim() || defaultTitle
          if (latestTitle === savedTitle && latestDraft.markdown === savedMarkdown) break

          await notesApi.updateNote(created.dados.id, {
            revision: next.revision,
            titulo: latestTitle,
            markdown: latestDraft.markdown,
            cor: created.dados.cor,
          })
          savedTitle = latestTitle
          savedMarkdown = latestDraft.markdown
          next = await notesApi.notes()
          onNotes(next)

          if (savedMarkdown.trim()) await wait(QUICK_CREATE_SETTLE_MS)
        }

        if (quickSession.current !== session) return
        replaceQuickDraft(null)
        setSelected(created.dados.id)
        setFocusNoteId(created.dados.id)
        setFocusToken((current) => current + 1)
      } catch (error) {
        onMessage('erro', error instanceof Error ? error.message : t('notes.fail_create'))
      } finally {
        quickPersisting.current = false
      }
    },
    [onNotes, onMessage, replaceQuickDraft, t],
  )

  const startDraft = useCallback(
    (initialMarkdown: string) => {
      const current = quickDraftRef.current
      if (current) {
        if (initialMarkdown) replaceQuickDraft({ ...current, markdown: `${current.markdown}${initialMarkdown}` })
        return
      }

      setSearch('')
      setSelected(null)
      setFocusNoteId(null)
      quickSession.current += 1
      const draft = {
        key: quickSession.current,
        title: t('notes.default_title'),
        markdown: initialMarkdown,
      }
      replaceQuickDraft(draft)
      requestAnimationFrame(() => draftEditor.current?.focus())
      void persistQuickDraft(quickSession.current)
    },
    [persistQuickDraft, replaceQuickDraft, t],
  )

  useImperativeHandle(ref, () => ({ quickCreate: (initialMarkdown = '') => startDraft(initialMarkdown) }), [startDraft])

  const selectNote = useCallback(
    (id: string) => {
      quickSession.current += 1
      replaceQuickDraft(null)
      setFocusNoteId(null)
      setSelected(id)
    },
    [replaceQuickDraft],
  )

  useEffect(() => {
    if (!navigationRequest || handledNavigationToken.current === navigationRequest.token) return
    handledNavigationToken.current = navigationRequest.token
    if (!notes.notas.some((note) => note.id === navigationRequest.id)) return

    quickSession.current += 1
    replaceQuickDraft(null)
    setSearch('')
    setFocusNoteId(navigationRequest.id)
    setFocusToken((current) => current + 1)
    setSelected(navigationRequest.id)
  }, [notes.notas, navigationRequest, replaceQuickDraft])

  useEffect(() => {
    if (!quickDraft) return
    const frame = requestAnimationFrame(() => draftEditor.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [quickDraft?.key])

  const archive = async (id: string) => {
    try {
      await notesApi.archiveNote(id, notes.revision)
      const next = await notesApi.notes()
      onNotes(next)
      setSelected(next.notas[0]?.id ?? null)
      onMessage('ok', t('notes.archived'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('notes.fail_archive'))
    }
  }

  return (
    <section className="notes">
      <NotesList
        notes={filtered}
        search={search}
        selected={selected}
        onSearch={setSearch}
        onSelect={selectNote}
        onCreate={() => startDraft('')}
        t={t}
      />
      <main className="note-editor">
        {quickDraft ? (
          <>
            <header className="note-editor__head">
              <input className="note-title" value={quickDraft.title} readOnly />
            </header>
            <DeferredMarkdownEditor
              ref={draftEditor}
              documentKey={`nova-nota-${quickDraft.key}`}
              markdown={quickDraft.markdown}
              onChange={updateQuickDraftMarkdown}
            />
          </>
        ) : selected ? (
          <NoteEditor
            id={selected}
            revision={notes.revision}
            cores={config.cores}
            autoFocusToken={selected === focusNoteId ? focusToken : undefined}
            onSaved={async () => onNotes(await notesApi.notes())}
            onPreview={(change) =>
              onNotes({
                ...notes,
                notas: notes.notas.map((note) => (note.id === selected ? { ...note, ...change } : note)),
              })
            }
            onArchive={() => archive(selected)}
            onMessage={onMessage}
          />
        ) : (
          <EmptyState>
            <p>{t('notes.view_empty')}</p>
            <Button variant="primary" type="button" onClick={() => startDraft('')}>
              <Plus size={15} /> {t('notes.new_button')}
            </Button>
          </EmptyState>
        )}
      </main>
    </section>
  )
})
