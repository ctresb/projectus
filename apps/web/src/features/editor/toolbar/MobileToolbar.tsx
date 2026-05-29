import { Bold, Italic, List } from 'lucide-react'
import { INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useT } from '../../../i18n'
import { editorStyles } from '../theme'
import { FormatToggle } from './FormatToggle'
import { InsertMenu } from './InsertMenu'
import { OverflowMenu } from './OverflowMenu'
import type { ToolbarState } from './Toolbar'
import { UndoRedo } from './UndoRedo'

export function MobileToolbar({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  return (
    <div className={`${editorStyles.toolbar} ${editorStyles.mobileToolbar}`}>
      <UndoRedo
        canUndo={state.canUndo}
        canRedo={false}
        undoLabel={t('editor.toolbar.undo')}
        redoLabel={t('editor.toolbar.redo')}
      />
      <FormatToggle active={state.formats.bold} format="bold" icon={Bold} label={t('editor.toolbar.bold')} />
      <FormatToggle active={state.formats.italic} format="italic" icon={Italic} label={t('editor.toolbar.italic')} />
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={t('editor.toolbar.bullet')}
        title={t('editor.toolbar.bullet')}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <List size={15} />
      </button>
      <InsertMenu />
      <OverflowMenu state={state} />
    </div>
  )
}
