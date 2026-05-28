import { Code2, Strikethrough, Underline } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../../i18n'
import { editorStyles } from '../theme'
import { FormatToggle } from './FormatToggle'
import type { ToolbarState } from './Toolbar'
import { UndoRedo } from './UndoRedo'

export function OverflowMenu({ state }: { state: ToolbarState }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className={editorStyles.insertMenu}>
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={t('editor.toolbar.more')}
        title={t('editor.toolbar.more')}
        onClick={() => setOpen((current) => !current)}
      >
        ...
      </button>
      {open && (
        <div className={`${editorStyles.popover} ${editorStyles.overflowMenu}`}>
          <UndoRedo
            canUndo={false}
            canRedo={state.canRedo}
            undoLabel={t('editor.toolbar.undo')}
            redoLabel={t('editor.toolbar.redo')}
          />
          <FormatToggle active={state.formats.underline} format="underline" icon={Underline} label={t('editor.toolbar.underline')} />
          <FormatToggle active={state.formats.strikethrough} format="strikethrough" icon={Strikethrough} label={t('editor.toolbar.strike')} />
          <FormatToggle active={state.formats.code} format="code" icon={Code2} label={t('editor.toolbar.inline_code')} />
        </div>
      )}
    </div>
  )
}
