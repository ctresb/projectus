import { forwardRef, lazy, Suspense } from 'react'
import { editorStyles } from './theme'
import type { MarkdownEditorHandle, MarkdownEditorProps } from './types'

const LoadedEditor = lazy(() => import('./MarkdownEditor').then((module) => ({ default: module.MarkdownEditor })))

export const DeferredMarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function DeferredMarkdownEditor(props, ref) {
  return (
    <Suspense fallback={<div className={editorStyles.loading}>carregando editor...</div>}>
      <LoadedEditor ref={ref} {...props} />
    </Suspense>
  )
})
