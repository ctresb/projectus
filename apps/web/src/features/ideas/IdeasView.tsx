import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Config, Ideas } from '../../lib/types'
import { useT } from '../../i18n'
import { Button, EmptyState } from '../../components/ui'
import type { MarkdownEditorHandle } from '../editor/MarkdownEditor'
import { DeferredMarkdownEditor } from '../editor/DeferredMarkdownEditor'
import { IdeaEditor } from './components/IdeaEditor'
import { IdeasList } from './components/IdeasList'

type QuickDraft = {
  key: number
  title: string
  markdown: string
}

const QUICK_CREATE_SETTLE_MS = 160

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    Boolean(target.closest('[role="dialog"], [role="listbox"], [role="menu"]'))
  )
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export function IdeasView({
  config,
  ideas,
  onIdeas,
  onMessage,
}: {
  config: Config
  ideas: Ideas
  onIdeas: (ideas: Ideas) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(ideas.notas[0]?.id ?? null)
  const [quickDraft, setQuickDraft] = useState<QuickDraft | null>(null)
  const [focusIdeaId, setFocusIdeaId] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const quickDraftRef = useRef<QuickDraft | null>(null)
  const quickPersisting = useRef(false)
  const quickSession = useRef(0)
  const draftEditor = useRef<MarkdownEditorHandle>(null)
  const filtered = useMemo(
    () => ideas.notas.filter((note) => note.titulo.toLowerCase().includes(search.toLowerCase())),
    [ideas.notas, search],
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

        const defaultTitle = t('ideas.default_title')
        let savedTitle = firstDraft.title.trim() || defaultTitle
        let savedMarkdown = firstDraft.markdown
        const created = await api.createIdea({ titulo: savedTitle, markdown: savedMarkdown })
        let next = await api.ideas()
        onIdeas(next)

        if (savedMarkdown.trim()) await wait(QUICK_CREATE_SETTLE_MS)

        while (quickSession.current === session) {
          const latestDraft = quickDraftRef.current
          if (!latestDraft) return

          const latestTitle = latestDraft.title.trim() || defaultTitle
          if (latestTitle === savedTitle && latestDraft.markdown === savedMarkdown) break

          await api.updateIdea(created.dados.id, {
            revision: next.revision,
            titulo: latestTitle,
            markdown: latestDraft.markdown,
            cor: created.dados.cor,
          })
          savedTitle = latestTitle
          savedMarkdown = latestDraft.markdown
          next = await api.ideas()
          onIdeas(next)

          if (savedMarkdown.trim()) await wait(QUICK_CREATE_SETTLE_MS)
        }

        if (quickSession.current !== session) return
        replaceQuickDraft(null)
        setSelected(created.dados.id)
        setFocusIdeaId(created.dados.id)
        setFocusToken((current) => current + 1)
      } catch (error) {
        onMessage('erro', error instanceof Error ? error.message : t('ideas.fail_create'))
      } finally {
        quickPersisting.current = false
      }
    },
    [onIdeas, onMessage, replaceQuickDraft, t],
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
      setFocusIdeaId(null)
      quickSession.current += 1
      const draft = {
        key: quickSession.current,
        title: t('ideas.default_title'),
        markdown: initialMarkdown,
      }
      replaceQuickDraft(draft)
      requestAnimationFrame(() => draftEditor.current?.focus())
      void persistQuickDraft(quickSession.current)
    },
    [persistQuickDraft, replaceQuickDraft, t],
  )

  const selectIdea = useCallback((id: string) => {
    quickSession.current += 1
    replaceQuickDraft(null)
    setFocusIdeaId(null)
    setSelected(id)
  }, [replaceQuickDraft])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target)) return
      const draft = quickDraftRef.current
      if (draft) {
        if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
          event.preventDefault()
          updateQuickDraftMarkdown(`${draft.markdown}${event.key}`)
        } else if (event.key === 'Backspace') {
          event.preventDefault()
          updateQuickDraftMarkdown(draft.markdown.slice(0, -1))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          updateQuickDraftMarkdown(`${draft.markdown}\n`)
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        startDraft('')
        return
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1 && event.key.trim()) {
        event.preventDefault()
        startDraft(event.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [startDraft, updateQuickDraftMarkdown])

  useEffect(() => {
    if (!quickDraft) return
    const frame = requestAnimationFrame(() => draftEditor.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [quickDraft?.key])

  const archive = async (id: string) => {
    try {
      await api.archiveIdea(id, ideas.revision)
      const next = await api.ideas()
      onIdeas(next)
      setSelected(next.notas[0]?.id ?? null)
      onMessage('ok', t('ideas.archived'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('ideas.fail_archive'))
    }
  }

  return (
    <section className="ideas">
      <IdeasList
        ideas={filtered}
        search={search}
        selected={selected}
        onSearch={setSearch}
        onSelect={selectIdea}
        onCreate={() => startDraft('')}
        t={t}
      />
      <main className="idea-editor">
        {quickDraft ? (
          <>
            <header className="idea-editor__head">
              <input className="idea-title" value={quickDraft.title} readOnly />
            </header>
            <DeferredMarkdownEditor
              ref={draftEditor}
              documentKey={`nova-ideia-${quickDraft.key}`}
              markdown={quickDraft.markdown}
              onChange={updateQuickDraftMarkdown}
            />
          </>
        ) : selected ? (
          <IdeaEditor
            id={selected}
            revision={ideas.revision}
            cores={config.cores}
            autoFocusToken={selected === focusIdeaId ? focusToken : undefined}
            onSaved={async () => onIdeas(await api.ideas())}
            onPreview={(change) =>
              onIdeas({
                ...ideas,
                notas: ideas.notas.map((idea) => (idea.id === selected ? { ...idea, ...change } : idea)),
              })
            }
            onArchive={() => archive(selected)}
            onMessage={onMessage}
          />
        ) : (
          <EmptyState>
            <p>{t('ideas.view_empty')}</p>
            <Button variant="primary" type="button" onClick={() => startDraft('')}>
              <Plus size={15} /> {t('ideas.new_button')}
            </Button>
          </EmptyState>
        )}
      </main>
    </section>
  )
}
