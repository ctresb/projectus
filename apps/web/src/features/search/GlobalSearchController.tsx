import { useEffect, useState } from 'react'
import type { Bootstrap } from '../../lib/types'
import { matchesShortcut } from './shortcuts'
import type { SearchNavigationTarget } from './types'
import { useGlobalSearchIndex } from './useGlobalSearchIndex'
import { GlobalSearchModal } from './GlobalSearchModal'

type GlobalSearchControllerProps = {
  workspace: Bootstrap
  onNavigate: (target: SearchNavigationTarget) => void
}

export function GlobalSearchController({ workspace, onNavigate }: GlobalSearchControllerProps) {
  const [open, setOpen] = useState(false)
  const { entries, indexing, indexError } = useGlobalSearchIndex(workspace)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcut(event)) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(true)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  return (
    <GlobalSearchModal
      aberto={open}
      entries={entries}
      indexing={indexing}
      indexError={indexError}
      onClose={() => setOpen(false)}
      onNavigate={onNavigate}
    />
  )
}
