import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ModalContainer, ModalContent } from '../../components/ui'
import { useT } from '../../i18n'
import { GLOBAL_SEARCH_SHORTCUT } from './shortcuts'
import { completeQueryWithScope, getScopedSearchQuery, searchEntries } from './searchIndex'
import type { GlobalSearchEntry, SearchNavigationTarget } from './types'
import { resultDomId } from './domIds'
import { SearchBar } from './components/SearchBar'
import { ResultsList } from './components/ResultsList'

type GlobalSearchModalProps = {
  aberto: boolean
  entries: GlobalSearchEntry[]
  indexing: boolean
  indexError: string | null
  onClose: () => void
  onNavigate: (target: SearchNavigationTarget) => void
}

export function GlobalSearchModal({
  aberto,
  entries,
  indexing,
  indexError,
  onClose,
  onNavigate,
}: GlobalSearchModalProps) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const scopedQuery = useMemo(() => getScopedSearchQuery(entries, query), [entries, query])
  const results = useMemo(() => searchEntries(entries, query), [entries, query])
  const activeEntry = results[activeIndex] ?? null
  const activeId = activeEntry ? resultDomId(activeEntry.id) : null

  useEffect(() => {
    if (!aberto) return
    setQuery('')
    setActiveIndex(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [aberto])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1))
  }, [activeIndex, results.length])

  const selectEntry = (entry: GlobalSearchEntry) => {
    onNavigate(entry.action)
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length === 0) return
      setActiveIndex((current) => Math.min(results.length - 1, current + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      setActiveIndex((current) => Math.max(0, current - 1))
      return
    }
    if (event.key === 'Enter' && activeEntry) {
      event.preventDefault()
      selectEntry(activeEntry)
      return
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      const completedQuery = results[0] ? completeQueryWithScope(entries, query, results[0]) : null
      if (!completedQuery) return
      event.preventDefault()
      setQuery(completedQuery)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <ModalContainer aberto={aberto} onClose={onClose} placement="center">
      <ModalContent titulo={t('search.title')} onClose={onClose} placement="center" className="global-search-modal">
        <div className="global-search" onKeyDown={onKeyDown}>
          <div className="global-search__input">
            <SearchBar
              inputRef={inputRef}
              inputValue={scopedQuery?.query ?? query}
              placeholder={t('search.placeholder')}
              scopedPlaceholder={t('search.scoped_placeholder')}
              shortcutLabel={GLOBAL_SEARCH_SHORTCUT.label}
              scopeTokens={scopedQuery?.tokens ?? []}
              activeDescendant={activeId ?? undefined}
              onChange={setQuery}
            />
          </div>
          <ResultsList
            results={results}
            activeId={activeId}
            query={query}
            indexing={indexing}
            indexError={indexError}
            onActive={setActiveIndex}
            onSelect={selectEntry}
          />
        </div>
      </ModalContent>
    </ModalContainer>
  )
}
