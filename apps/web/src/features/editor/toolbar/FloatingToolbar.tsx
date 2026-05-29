import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Bold, Code2, Italic, Link, Strikethrough, Underline } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../../i18n'
import { editorStyles } from '../theme'
import { FormatToggle } from './FormatToggle'
import type { ToolbarFormats } from './Toolbar'

export function FloatingToolbar({ formats }: { formats: ToolbarFormats }) {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')

  return (
    <div className={editorStyles.floatingToolbar}>
      <FormatToggle active={formats.bold} format="bold" icon={Bold} label={t('editor.toolbar.bold')} />
      <FormatToggle active={formats.italic} format="italic" icon={Italic} label={t('editor.toolbar.italic')} />
      <FormatToggle
        active={formats.underline}
        format="underline"
        icon={Underline}
        label={t('editor.toolbar.underline')}
      />
      <FormatToggle
        active={formats.strikethrough}
        format="strikethrough"
        icon={Strikethrough}
        label={t('editor.toolbar.strike')}
      />
      <FormatToggle active={formats.code} format="code" icon={Code2} label={t('editor.toolbar.inline_code')} />
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={t('editor.toolbar.link')}
        title={t('editor.toolbar.link')}
        onClick={() => setLinkOpen((current) => !current)}
      >
        <Link size={15} />
      </button>
      {linkOpen && (
        <form
          className={editorStyles.linkForm}
          onSubmit={(event) => {
            event.preventDefault()
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim() || null)
            setUrl('')
            setLinkOpen(false)
          }}
        >
          <input
            className={editorStyles.linkInput}
            value={url}
            placeholder={t('editor.link.placeholder')}
            onChange={(event) => setUrl(event.target.value)}
          />
        </form>
      )}
    </div>
  )
}
