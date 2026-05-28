import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { REDO_COMMAND, UNDO_COMMAND } from 'lexical'
import { Redo2, Undo2 } from 'lucide-react'
import { editorStyles } from '../theme'

export function UndoRedo({
  canRedo,
  canUndo,
  redoLabel,
  undoLabel,
}: {
  canRedo: boolean
  canUndo: boolean
  redoLabel: string
  undoLabel: string
}) {
  const [editor] = useLexicalComposerContext()
  return (
    <>
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={undoLabel}
        title={undoLabel}
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <Undo2 size={15} />
      </button>
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={redoLabel}
        title={redoLabel}
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <Redo2 size={15} />
      </button>
    </>
  )
}
