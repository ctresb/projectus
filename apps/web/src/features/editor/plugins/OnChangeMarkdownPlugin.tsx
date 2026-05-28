import { $convertToMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, type MutableRefObject } from 'react'
import { EXTENDED_TRANSFORMERS } from '../transformers'

export function OnChangeMarkdownPlugin({
  lastEmittedMarkdown,
  onChange,
}: {
  lastEmittedMarkdown: MutableRefObject<string>
  onChange: (markdown: string) => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, tags }) => {
        if (tags.has('external')) return
        const nextMarkdown = editorState.read(() => $convertToMarkdownString(EXTENDED_TRANSFORMERS, undefined, false))
        if (nextMarkdown === lastEmittedMarkdown.current) return
        lastEmittedMarkdown.current = nextMarkdown
        onChange(nextMarkdown)
      }),
    [editor, lastEmittedMarkdown, onChange],
  )

  return null
}
