import { Search } from 'lucide-react'
import type { KeyboardEvent, RefObject } from 'react'
import { cx } from '../../../lib/classnames'
import type { SearchScopeToken as SearchScopeTokenValue } from '../types'
import { SearchScopeToken } from './SearchScopeToken'

type SearchBarProps = {
  inputValue: string
  placeholder: string
  scopedPlaceholder: string
  shortcutLabel: string
  activeDescendant?: string
  inputRef: RefObject<HTMLInputElement | null>
  scopeTokens?: SearchScopeTokenValue[]
  onChange: (value: string) => void
}

export function SearchBar({
  inputValue,
  placeholder,
  scopedPlaceholder,
  shortcutLabel,
  activeDescendant,
  inputRef,
  scopeTokens = [],
  onChange,
}: SearchBarProps) {
  const hasScope = scopeTokens.length > 0
  const inputPlaceholder = hasScope ? scopedPlaceholder : placeholder
  const scopePrefix = scopeTokens.map((token) => token.raw).join('/')

  const updateValue = (next: string) => {
    onChange(hasScope ? `${scopePrefix}/${next}` : next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!hasScope || inputValue !== '' || event.key !== 'Backspace') return
    event.preventDefault()
    const remainingScope = scopeTokens
      .slice(0, -1)
      .map((token) => token.raw)
      .join('/')
    onChange(remainingScope ? `${remainingScope}/` : '')
  }

  return (
    <label className={cx('global-search-bar', hasScope && 'global-search-bar--scoped')}>
      <Search size={18} aria-hidden />
      {scopeTokens.map((token, index) => (
        <SearchScopeToken key={`${token.raw}-${index}`} token={token} />
      ))}
      <input
        ref={inputRef}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-controls="global-search-results"
        aria-label={placeholder}
        autoComplete="off"
        role="combobox"
        spellCheck={false}
        value={inputValue}
        placeholder={inputPlaceholder}
        onChange={(event) => updateValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <kbd>{shortcutLabel}</kbd>
    </label>
  )
}
