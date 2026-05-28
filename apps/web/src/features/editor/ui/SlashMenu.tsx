import type { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useT } from '../../../i18n'
import { editorStyles } from '../theme'
import type { SlashMenuOption } from '../plugins/SlashMenuPlugin'
import { SlashMenuItem } from './SlashMenuItem'

export function SlashMenu({
  options,
  selectOption,
  selectedIndex,
  setHighlightedIndex,
}: {
  options: SlashMenuOption[]
  selectOption: (option: SlashMenuOption) => void
  selectedIndex: number | null
  setHighlightedIndex: (index: number) => void
}) {
  const t = useT()
  if (options.length === 0) return null
  return (
    <div className={`${editorStyles.popover} ${editorStyles.menuList}`}>
      {options.map((option, index) => (
        <SlashMenuItem
          key={(option as MenuOption).key}
          item={option.item}
          label={t(option.item.labelKey)}
          selected={selectedIndex === index}
          setRef={option.setRefElement.bind(option)}
          onClick={() => {
            setHighlightedIndex(index)
            selectOption(option)
          }}
        />
      ))}
    </div>
  )
}
