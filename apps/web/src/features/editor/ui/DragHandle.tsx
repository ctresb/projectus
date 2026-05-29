import { GripVertical } from 'lucide-react'
import { editorStyles } from '../theme'

export function DragHandle() {
  return (
    <div
      className={editorStyles.dragHandle}
      data-editor-drag-handle
      aria-label="drag block"
      role="button"
      tabIndex={-1}
    >
      <GripVertical size={15} />
    </div>
  )
}
