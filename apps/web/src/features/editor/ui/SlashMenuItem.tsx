import type { SlashItem } from '../toolbar/items'
import { editorStyles } from '../theme'

export function SlashMenuItem({
  item,
  label,
  onClick,
  selected,
  setRef,
}: {
  item: SlashItem
  label: string
  onClick: () => void
  selected: boolean
  setRef: (element: HTMLElement | null) => void
}) {
  const Icon = item.icon
  return (
    <button
      ref={setRef}
      type="button"
      className={`${editorStyles.menuItem} ${selected ? editorStyles.menuItemSelected : ''}`.trim()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}
