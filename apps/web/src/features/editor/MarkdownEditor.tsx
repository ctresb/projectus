import { forwardRef } from 'react'
import { Composer } from './composer/Composer'
import type { MarkdownEditorHandle, MarkdownEditorProps } from './types'

export type { MarkdownEditorHandle, MarkdownEditorProps }

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(props, ref) {
  return <Composer ref={ref} {...props} />
})
