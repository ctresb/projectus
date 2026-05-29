import { LexicalTypeaheadMenuPlugin, MenuOption, type MenuTextMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTextNode, CLICK_COMMAND, COMMAND_PRIORITY_LOW, TextNode } from 'lexical'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useEditorProps } from '../context/EditorPropsContext'
import { $createWikilinkNode } from '../nodes/WikilinkNode'
import type { SearchEntry } from '../types'
import { MentionPopover } from '../ui/MentionPopover'

class WikilinkOption extends MenuOption implements SearchEntry {
  id: string
  label: string

  constructor(entry: SearchEntry) {
    super(entry.id)
    this.id = entry.id
    this.label = entry.label
  }
}

function wikilinkTrigger(text: string): MenuTextMatch | null {
  const match = /\[\[([^\]]*)$/.exec(text)
  if (!match) return null
  return {
    leadOffset: match.index,
    matchingString: match[1],
    replaceableString: `[[${match[1]}`,
  }
}

function replaceWithWikilink(textNode: TextNode | null, matchingString: string, entry: SearchEntry) {
  if (!textNode) return
  const text = textNode.getTextContent()
  const replaceable = `[[${matchingString}`
  const start = text.lastIndexOf(replaceable)
  if (start < 0) return
  textNode.spliceText(start, text.length - start, '', false)
  const inserted = textNode.insertAfter($createWikilinkNode(entry.id, entry.label))
  inserted.insertAfter($createTextNode(' '))
  inserted.selectNext()
}

export function WikilinkPlugin() {
  const [editor] = useLexicalComposerContext()
  const { onWikilinkClick, searchEntries } = useEditorProps()
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[]>([])

  useEffect(() => {
    if (!searchEntries) {
      setEntries([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchEntries(query).then((result) => {
        if (!cancelled) setEntries(result)
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchEntries])

  useEffect(() => {
    if (!onWikilinkClick) return
    return editor.registerCommand(
      CLICK_COMMAND,
      (event) => {
        if (!event.metaKey && !event.ctrlKey) return false
        const target = event.target as HTMLElement
        const wikilink = target.closest<HTMLElement>('[data-lexical-type="wikilink"]')
        const id = wikilink?.dataset.targetId
        if (!id) return false
        event.preventDefault()
        onWikilinkClick(id)
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, onWikilinkClick])

  const options = useMemo(() => entries.map((entry) => new WikilinkOption(entry)), [entries])
  if (!searchEntries) return null

  return (
    <LexicalTypeaheadMenuPlugin<WikilinkOption>
      triggerFn={wikilinkTrigger}
      options={options}
      preselectFirstItem
      onQueryChange={(nextQuery) => setQuery(nextQuery ?? '')}
      onSelectOption={(option, textNodeContainingQuery, closeMenu, matchingString) => {
        editor.update(() => replaceWithWikilink(textNodeContainingQuery, matchingString, option))
        closeMenu()
      }}
      menuRenderFn={(
        anchorElementRef,
        { options: menuOptions, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        const anchor = anchorElementRef.current
        if (!anchor) return null
        return createPortal(
          <MentionPopover
            options={menuOptions}
            selectedIndex={selectedIndex}
            setHighlightedIndex={setHighlightedIndex}
            onSelect={selectOptionAndCleanUp}
            getRef={(option) => option.setRefElement.bind(option)}
          />,
          anchor,
        )
      }}
    />
  )
}
