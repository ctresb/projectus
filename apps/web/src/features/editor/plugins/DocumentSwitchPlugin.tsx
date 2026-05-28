import { $convertFromMarkdownString } from '@lexical/markdown'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $getRoot, CLEAR_HISTORY_COMMAND } from 'lexical'
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { EXTENDED_TRANSFORMERS } from '../transformers'

export function DocumentSwitchPlugin({
  documentKey,
  lastEmittedMarkdown,
  markdown,
  scrollerRef,
}: {
  documentKey: string
  lastEmittedMarkdown: MutableRefObject<string>
  markdown: string
  scrollerRef: RefObject<HTMLElement | null>
}) {
  const [editor] = useLexicalComposerContext()
  const previousDocument = useRef(documentKey)
  const lastImportedMarkdown = useRef(markdown)

  useEffect(() => {
    const switchedDocument = previousDocument.current !== documentKey
    const externalMarkdown = markdown !== lastEmittedMarkdown.current && markdown !== lastImportedMarkdown.current
    if (!switchedDocument && !externalMarkdown) return

    previousDocument.current = documentKey
    lastImportedMarkdown.current = markdown
    const scrollTop = scrollerRef.current?.scrollTop ?? 0

    editor.update(
      () => {
        const root = $getRoot()
        root.clear()
        $convertFromMarkdownString(markdown, EXTENDED_TRANSFORMERS, root, false)
        if (root.getChildrenSize() === 0) root.append($createParagraphNode())
      },
      {
        onUpdate: () => {
          if (switchedDocument) {
            editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined)
            if (scrollerRef.current) scrollerRef.current.scrollTop = 0
          } else if (scrollerRef.current) {
            scrollerRef.current.scrollTop = scrollTop
          }
        },
        tag: 'external',
      },
    )
  }, [documentKey, editor, lastEmittedMarkdown, markdown, scrollerRef])

  return null
}
