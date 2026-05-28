import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { forwardRef, useImperativeHandle } from 'react'
import type { MarkdownEditorHandle } from '../types'

export const ImperativeHandleBridge = forwardRef<MarkdownEditorHandle>(function ImperativeHandleBridge(_, ref) {
  const [editor] = useLexicalComposerContext()

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor.focus(undefined, { defaultSelection: 'rootEnd' })
      },
    }),
    [editor],
  )

  return null
})
