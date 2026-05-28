import { $convertFromMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $getRoot } from 'lexical'
import { useEffect, useRef } from 'react'
import { EXTENDED_TRANSFORMERS } from '../transformers'

export function MarkdownInitPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext()
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    editor.update(
      () => {
        const root = $getRoot()
        root.clear()
        $convertFromMarkdownString(markdown, EXTENDED_TRANSFORMERS, root, false)
        if (root.getChildrenSize() === 0) root.append($createParagraphNode())
      },
      { tag: 'external' },
    )
  }, [editor, markdown])

  return null
}
