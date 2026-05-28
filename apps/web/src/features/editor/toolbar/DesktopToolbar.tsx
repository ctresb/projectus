import { Code2, Italic, List, ListChecks, ListOrdered, Strikethrough, Underline, Bold } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { useT } from '../../../i18n'
import { editorStyles } from '../theme'
import { BlockTypeSelect } from './BlockTypeSelect'
import { FormatToggle } from './FormatToggle'
import { InsertMenu } from './InsertMenu'
import type { ToolbarState } from './Toolbar'
import { UndoRedo } from './UndoRedo'

export function DesktopToolbar({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  return (
    <div className={`${editorStyles.toolbar} ${editorStyles.desktopToolbar}`}>
      <div className={editorStyles.toolbarGroup}>
        <UndoRedo
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          undoLabel={t('editor.toolbar.undo')}
          redoLabel={t('editor.toolbar.redo')}
        />
      </div>
      <BlockTypeSelect
        blockType={state.blockType}
        labels={{
          bullet: t('editor.block.bullet'),
          check: t('editor.block.check'),
          code: t('editor.block.code'),
          h1: t('editor.block.h1'),
          h2: t('editor.block.h2'),
          h3: t('editor.block.h3'),
          numbered: t('editor.block.numbered'),
          paragraph: t('editor.block.paragraph'),
          quote: t('editor.block.quote'),
        }}
      />
      <div className={editorStyles.toolbarGroup}>
        <FormatToggle active={state.formats.bold} format="bold" icon={Bold} label={t('editor.toolbar.bold')} />
        <FormatToggle active={state.formats.italic} format="italic" icon={Italic} label={t('editor.toolbar.italic')} />
        <FormatToggle active={state.formats.underline} format="underline" icon={Underline} label={t('editor.toolbar.underline')} />
        <FormatToggle active={state.formats.strikethrough} format="strikethrough" icon={Strikethrough} label={t('editor.toolbar.strike')} />
        <FormatToggle active={state.formats.code} format="code" icon={Code2} label={t('editor.toolbar.inline_code')} />
      </div>
      <div className={editorStyles.toolbarGroup}>
        <button
          type="button"
          className={editorStyles.toolbarButton}
          aria-label={t('editor.toolbar.bullet')}
          title={t('editor.toolbar.bullet')}
          onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={editorStyles.toolbarButton}
          aria-label={t('editor.toolbar.numbered')}
          title={t('editor.toolbar.numbered')}
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          className={editorStyles.toolbarButton}
          aria-label={t('editor.toolbar.check')}
          title={t('editor.toolbar.check')}
          onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}
        >
          <ListChecks size={15} />
        </button>
      </div>
      <InsertMenu />
    </div>
  )
}
