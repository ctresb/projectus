import { LexicalTypeaheadMenuPlugin, MenuOption, type MenuTextMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $insertNodes, $isRangeSelection, TextNode } from 'lexical'
import { createPortal } from 'react-dom'
import { useMemo, useRef, useState } from 'react'
import { useT } from '../../../i18n'
import { useUploadImage } from '../hooks/useUploadImage'
import { $createImageNode } from '../nodes/ImageNode'
import { filterSlashItems, SLASH_ITEMS, type SlashItem } from '../toolbar/items'
import { SlashMenu } from '../ui/SlashMenu'

export class SlashMenuOption extends MenuOption {
  item: SlashItem

  constructor(item: SlashItem) {
    super(item.id)
    this.item = item
  }
}

function slashTrigger(text: string): MenuTextMatch | null {
  const match = /(^|\s)\/([^\s/]*)$/.exec(text)
  if (!match) return null
  const replaceableString = `/${match[2]}`
  return {
    leadOffset: text.length - replaceableString.length,
    matchingString: match[2],
    replaceableString,
  }
}

function removeTriggerText(textNode: TextNode | null, matchingString: string) {
  if (!textNode) return
  const text = textNode.getTextContent()
  const replaceable = `/${matchingString}`
  const start = text.lastIndexOf(replaceable)
  if (start < 0) return
  textNode.spliceText(start, text.length - start, '', true)
}

export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  const uploadImage = useUploadImage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const options = useMemo(
    () => filterSlashItems(SLASH_ITEMS, query, t).map((item) => new SlashMenuOption(item)),
    [query, t],
  )

  return (
    <>
      <LexicalTypeaheadMenuPlugin<SlashMenuOption>
        triggerFn={slashTrigger}
        options={options}
        preselectFirstItem
        onQueryChange={(nextQuery) => setQuery(nextQuery ?? '')}
        onSelectOption={(option, textNodeContainingQuery, closeMenu, matchingString) => {
          editor.update(() => {
            removeTriggerText(textNodeContainingQuery, matchingString)
          })
          closeMenu()
          option.item.run(editor, { requestImageUpload: () => inputRef.current?.click() })
        }}
        menuRenderFn={(anchorElementRef, { options: menuOptions, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
          const anchor = anchorElementRef.current
          if (!anchor) return null
          return createPortal(
            <SlashMenu
              options={menuOptions}
              selectedIndex={selectedIndex}
              setHighlightedIndex={setHighlightedIndex}
              selectOption={selectOptionAndCleanUp}
            />,
            anchor,
          )
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file || !uploadImage) return
          void uploadImage(file).then((src) => {
            editor.update(() => {
              const selection = $getSelection()
              if ($isRangeSelection(selection)) $insertNodes([$createImageNode({ altText: file.name, src })])
            })
          })
        }}
      />
    </>
  )
}
