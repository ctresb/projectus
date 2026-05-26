import { forwardRef, lazy, Suspense } from 'react'
import type { MarkdownEditorHandle } from './MarkdownEditor'

const LoadedEditor = lazy(() => import('./MarkdownEditor').then((module) => ({ default: module.MarkdownEditor })))

type Props = {
  markdown: string
  onChange: (markdown: string) => void
  uploadImage?: (file: File) => Promise<string>
}

export const DeferredMarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function DeferredMarkdownEditor(props, ref) {
  return (
    <Suspense fallback={<div className="editor-loading">carregando editor...</div>}>
      <LoadedEditor ref={ref} {...props} />
    </Suspense>
  )
})
