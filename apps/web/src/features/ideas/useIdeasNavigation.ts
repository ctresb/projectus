import { useNavigationRequest } from '../../hooks/useNavigationRequest'
import type { Ideas } from '../../lib/types'

type QuickDraft = {
  key: number
  title: string
  markdown: string
}

/**
 * Adopts the shared {@link useNavigationRequest} to focus an idea when the app
 * routes to a specific note. Mirrors the original inline effect: the token is
 * marked handled even when the target idea is missing (no retry), so the handler
 * returns `void` in every branch rather than `false`.
 */
export function useIdeasNavigation({
  navigationRequest,
  notas,
  quickSession,
  replaceQuickDraft,
  setSearch,
  setFocusIdeaId,
  setFocusToken,
  setSelected,
}: {
  navigationRequest?: { id: string; token: number } | null
  notas: Ideas['notas']
  quickSession: { current: number }
  replaceQuickDraft: (draft: QuickDraft | null) => void
  setSearch: (value: string) => void
  setFocusIdeaId: (id: string | null) => void
  setFocusToken: (updater: (current: number) => number) => void
  setSelected: (id: string | null) => void
}) {
  useNavigationRequest(
    navigationRequest,
    (request) => {
      if (!notas.some((idea) => idea.id === request.id)) return

      quickSession.current += 1
      replaceQuickDraft(null)
      setSearch('')
      setFocusIdeaId(request.id)
      setFocusToken((current) => current + 1)
      setSelected(request.id)
    },
    [notas],
  )
}
