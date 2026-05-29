import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  PUNCTUATION,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createTextNode, TextNode } from 'lexical'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useEditorProps } from '../context/EditorPropsContext'
import { $createMentionNode } from '../nodes/MentionNode'
import type { MentionEntry } from '../types'
import { MentionPopover } from '../ui/MentionPopover'

class MentionOption extends MenuOption implements MentionEntry {
  id: string
  label: string
  subtitle?: string

  constructor(entry: MentionEntry) {
    super(entry.id)
    this.id = entry.id
    this.label = entry.label
    this.subtitle = entry.subtitle
  }
}

function replaceWithMention(textNode: TextNode | null, matchingString: string, entry: MentionEntry) {
  if (!textNode) return
  const text = textNode.getTextContent()
  const replaceable = `@${matchingString}`
  const start = text.lastIndexOf(replaceable)
  if (start < 0) return
  const before = start === 0 ? '' : text[start - 1]
  if (before && /[A-Za-z0-9_]/.test(before)) return
  textNode.spliceText(start, text.length - start, '', false)
  const inserted = textNode.insertAfter($createMentionNode(entry.id, entry.label))
  inserted.insertAfter($createTextNode(' '))
  inserted.selectNext()
}

export function MentionPlugin() {
  const [editor] = useLexicalComposerContext()
  const { searchMentions } = useEditorProps()
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<MentionEntry[]>([])
  const baseTrigger = useBasicTypeaheadTriggerMatch('@', { minLength: 0, punctuation: PUNCTUATION })

  useEffect(() => {
    if (!searchMentions) {
      setEntries([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchMentions(query).then((result) => {
        if (!cancelled) setEntries(result)
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchMentions])

  const options = useMemo(() => entries.map((entry) => new MentionOption(entry)), [entries])
  if (!searchMentions) return null

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      triggerFn={(text, lexicalEditor) => {
        const match = baseTrigger(text, lexicalEditor)
        if (!match) return null
        const start = match.leadOffset - 1
        if (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) return null
        return match
      }}
      options={options}
      preselectFirstItem
      onQueryChange={(nextQuery) => setQuery(nextQuery ?? '')}
      onSelectOption={(option, textNodeContainingQuery, closeMenu, matchingString) => {
        editor.update(() => replaceWithMention(textNodeContainingQuery, matchingString, option))
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
