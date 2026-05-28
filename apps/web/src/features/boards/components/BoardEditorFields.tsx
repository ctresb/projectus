import { forwardRef, type FormHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { CommaTagsInput } from '../../../components/CommaTagsInput'
import { ColorPicker } from '../../../components/ColorPicker'
import { TagPicker } from '../../../components/TagPicker'
import type { MarkdownEditorHandle } from '../../editor/MarkdownEditor'
import { DeferredMarkdownEditor } from '../../editor/DeferredMarkdownEditor'
import { editorStyles } from '../../editor/theme'
import type { ColorChoice, Tag } from '../../../lib/types'
import { Button } from '../../../components/ui'

export const BoardEditorForm = forwardRef<
  HTMLFormElement,
  FormHTMLAttributes<HTMLFormElement> & {
    children: ReactNode
  }
>(function BoardEditorForm({ children, className, ...props }, ref) {
  return (
    <form ref={ref} className={`editor-form ${className ?? ''}`.trim()} {...props}>
      {children}
    </form>
  )
})

export function MarkdownField({
  label,
  documentKey,
  markdown,
  editorRef,
  onChange,
  uploadImage,
  loading,
  loadingLabel,
}: {
  label: string
  documentKey: string
  markdown: string
  editorRef?: RefObject<MarkdownEditorHandle | null>
  onChange: (value: string) => void
  uploadImage?: (file: File) => Promise<string>
  loading?: boolean
  loadingLabel?: string
}) {
  return (
    <div className="editor-form__markdown">
      <span>{label}</span>
      {loading ? (
        <div className={editorStyles.loading}>{loadingLabel}</div>
      ) : (
        <DeferredMarkdownEditor
          ref={editorRef}
          documentKey={documentKey}
          markdown={markdown}
          onChange={onChange}
          uploadImage={uploadImage}
        />
      )}
    </div>
  )
}

export function ColorAndTagsFields({
  colorLabel,
  colorAriaLabel,
  tagsLabel,
  cores,
  cor,
  tagsDisponiveis,
  tags,
  onColorChange,
  onTagsChange,
  onCreateTag,
}: {
  colorLabel: string
  colorAriaLabel: string
  tagsLabel: string
  cores: ColorChoice[]
  cor: string
  tagsDisponiveis: Tag[]
  tags: string[]
  onColorChange: (value: string) => void
  onTagsChange: (value: string[]) => void
  onCreateTag?: (tag: Tag) => void
}) {
  return (
    <div className="inline-options">
      <div>
        <span className="field-label">{colorLabel}</span>
        <ColorPicker cores={cores} value={cor} onChange={onColorChange} label={colorAriaLabel} />
      </div>
      <div>
        <span className="field-label">{tagsLabel}</span>
        <TagPicker disponiveis={tagsDisponiveis} value={tags} onChange={onTagsChange} />
        {onCreateTag && <CommaTagsInput cores={cores} onCreate={onCreateTag} />}
      </div>
    </div>
  )
}

export function EditorActions({
  cancelLabel,
  submitLabel,
  onCancel,
}: {
  cancelLabel: string
  submitLabel: string
  onCancel: () => void
}) {
  return (
    <footer className="form-actions">
      <Button type="button" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant="primary" type="submit">
        {submitLabel}
      </Button>
    </footer>
  )
}
