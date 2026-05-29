import { EmptyState, LoadingState } from '../../../components/ui'
import { SquareScrollArea } from '../../../components/SquareScrollArea'
import { useT } from '../../../i18n'
import type { GlobalSearchEntry } from '../types'
import { resultDomId } from '../domIds'
import { ResultCard } from './ResultCard'

type ResultsListProps = {
  results: GlobalSearchEntry[]
  activeId: string | null
  query: string
  indexing: boolean
  indexError: string | null
  onActive: (index: number) => void
  onSelect: (entry: GlobalSearchEntry) => void
}

export function ResultsList({
  results,
  activeId,
  query,
  indexing,
  indexError,
  onActive,
  onSelect,
}: ResultsListProps) {
  const t = useT()
  const hasResults = results.length > 0

  return (
    <>
      <SquareScrollArea className="global-search-results" viewportClassName="global-search-results__viewport">
        <div className="global-search-results__list" id="global-search-results" role="listbox">
          {results.map((entry, index) => {
            const id = resultDomId(entry.id)
            return (
              <ResultCard
                key={entry.id}
                id={id}
                entry={entry}
                active={activeId === id}
                onActive={() => onActive(index)}
                onSelect={() => onSelect(entry)}
              />
            )
          })}
          {!hasResults && indexing && <LoadingState className="global-search-state">{t('search.indexing')}</LoadingState>}
          {!hasResults && !indexing && (
            <EmptyState className="global-search-state">
              {query.trim() ? t('search.empty') : t('search.empty_query')}
            </EmptyState>
          )}
        </div>
      </SquareScrollArea>
      <footer className="global-search-footer">
        <span>{indexError ?? (indexing ? t('search.indexing') : t('search.result_count', { count: results.length }))}</span>
      </footer>
    </>
  )
}
