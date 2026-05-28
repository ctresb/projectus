import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, type TextFormatType } from 'lexical'
import type { LucideIcon } from 'lucide-react'
import { editorStyles } from '../theme'

export function FormatToggle({
  active,
  format,
  icon: Icon,
  label,
}: {
  active?: boolean
  format: TextFormatType
  icon: LucideIcon
  label: string
}) {
  const [editor] = useLexicalComposerContext()
  return (
    <button
      type="button"
      className={`${editorStyles.formatToggle} ${active ? editorStyles.formatToggleActive : ''}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
    >
      <Icon size={15} />
    </button>
  )
}
