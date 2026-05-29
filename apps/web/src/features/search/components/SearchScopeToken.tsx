import type { CSSProperties } from 'react'
import type { SearchScopeToken as SearchScopeTokenValue } from '../types'
import { scopeTokenStyle } from '../scopeColors'

type SearchScopeTokenProps = {
  token: SearchScopeTokenValue
}

export function SearchScopeToken({ token }: SearchScopeTokenProps) {
  return (
    <span className="global-search-scope" style={scopeTokenStyle(token.color) as CSSProperties}>
      {token.label}/
    </span>
  )
}
