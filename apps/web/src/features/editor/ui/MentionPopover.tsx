import { editorStyles } from '../theme'

export type MentionPopoverOption = {
  id: string
  label: string
  subtitle?: string
}

export function MentionPopover<T extends MentionPopoverOption>({
  getRef,
  options,
  onSelect,
  selectedIndex,
  setHighlightedIndex,
}: {
  getRef: (option: T) => (element: HTMLElement | null) => void
  options: T[]
  onSelect: (option: T) => void
  selectedIndex: number | null
  setHighlightedIndex: (index: number) => void
}) {
  if (options.length === 0) return null
  return (
    <div className={`${editorStyles.popover} ${editorStyles.menuList}`}>
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={getRef(option)}
          type="button"
          className={`${editorStyles.menuItem} ${selectedIndex === index ? editorStyles.menuItemSelected : ''}`.trim()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setHighlightedIndex(index)
            onSelect(option)
          }}
        >
          <span>#</span>
          <span>
            {option.label}
            {option.subtitle && <span className={editorStyles.menuItemSubtitle}>{option.subtitle}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
