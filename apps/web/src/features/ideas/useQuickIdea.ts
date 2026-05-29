import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Ideas } from '../../lib/types'
import { useT } from '../../i18n'
import type { MarkdownEditorHandle } from '../editor/MarkdownEditor'

export type QuickDraft = {
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

/**
 * Bespoke quick-create flow for ideas. The shared `useQuickCreate` does not fit:
 * (1) it only handles the "no draft yet" keydown branch (Cmd+N / first char) and
 * has no notion of the create-then-update draft loop, and (2) its editing-target
 * guard only checks `[role="dialog"]`, whereas ideas must also ignore keystrokes
 * inside `[role="listbox"]` and `[role="menu"]`. Reusing it would drop the
 * draft-typing branch and silently change which targets suppress quick-create.
 */
export function useQuickIdea({
  onIdeas,
  onMessage,
  setSearch,
  setSelected,
  setFocusIdeaId,
  setFocusToken,
}: {
  onIdeas: (ideas: Ideas) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
  setSearch: (value: string) => void
  setSelected: (id: string | null) => void
  setFocusIdeaId: (id: string | null) => void
  setFocusToken: (updater: (current: number) => number) => void
}) {
  const t = useT()
  const [quickDraft, setQuickDraft] = useState<QuickDraft | null>(null)
  const quickDraftRef = useRef<QuickDraft | null>(null)
  const quickPersisting = useRef(false)
  const quickSession = useRef(0)
  const draftEditor = useRef<MarkdownEditorHandle>(null)

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
    [onIdeas, onMessage, replaceQuickDraft, setFocusIdeaId, setFocusToken, setSelected, t],
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
    [persistQuickDraft, replaceQuickDraft, setFocusIdeaId, setSearch, setSelected, t],
  )

  const selectIdea = useCallback(
    (id: string) => {
      quickSession.current += 1
      replaceQuickDraft(null)
      setFocusIdeaId(null)
      setSelected(id)
    },
    [replaceQuickDraft, setFocusIdeaId, setSelected],
  )

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

  return {
    quickDraft,
    quickSession,
    draftEditor,
    replaceQuickDraft,
    updateQuickDraftMarkdown,
    startDraft,
    selectIdea,
  }
}
