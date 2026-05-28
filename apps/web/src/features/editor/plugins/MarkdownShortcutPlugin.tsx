import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { registerMarkdownShortcuts } from '@lexical/markdown'
import { useEffect } from 'react'
import { EXTENDED_TRANSFORMERS } from '../transformers'

export function MarkdownShortcutPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => registerMarkdownShortcuts(editor, EXTENDED_TRANSFORMERS), [editor])

  return null
}
