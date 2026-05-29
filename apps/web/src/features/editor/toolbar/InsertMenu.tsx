import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $insertNodes, $isRangeSelection } from 'lexical'
import { Code2, Image, Link, Minus, Plus, Table, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { useT } from '../../../i18n'
import { useUploadImage } from '../hooks/useUploadImage'
import { $createImageNode } from '../nodes/ImageNode'
import { editorStyles } from '../theme'
import { SLASH_ITEMS } from './items'

export function InsertMenu() {
  const [editor] = useLexicalComposerContext()
  const t = useT()
  const uploadImage = useUploadImage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)

  const pickImage = () => {
    setOpen(false)
    inputRef.current?.click()
  }

  const insertLiteral = (text: string) => {
    setOpen(false)
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertText(text)
    })
    editor.focus()
  }

  return (
    <div className={editorStyles.insertMenu}>
      <button
        type="button"
        className={editorStyles.toolbarButton}
        aria-label={t('editor.toolbar.insert')}
        title={t('editor.toolbar.insert')}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus size={15} />
      </button>
      {open && (
        <div className={`${editorStyles.popover} ${editorStyles.insertMenuPanel}`}>
          <button type="button" className={editorStyles.toolbarButton} disabled={!uploadImage} onClick={pickImage}>
            <Image size={15} /> {t('editor.toolbar.image')}
          </button>
          <button
            type="button"
            className={editorStyles.toolbarButton}
            onClick={() => {
              setOpen(false)
              editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', includeHeaders: true, rows: '3' })
            }}
          >
            <Table size={15} /> {t('editor.toolbar.table')}
          </button>
          <button
            type="button"
            className={editorStyles.toolbarButton}
            onClick={() => {
              setOpen(false)
              editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
            }}
          >
            <Minus size={15} /> {t('editor.toolbar.hr')}
          </button>
          <button
            type="button"
            className={editorStyles.toolbarButton}
            onClick={() => {
              setOpen(false)
              SLASH_ITEMS.find((item) => item.id === 'code')?.run(editor)
            }}
          >
            <Code2 size={15} /> {t('editor.toolbar.code_block')}
          </button>
          <button type="button" className={editorStyles.toolbarButton} onClick={() => insertLiteral('[[')}>
            <Link size={15} /> {t('editor.toolbar.wikilink')}
          </button>
          <button type="button" className={editorStyles.toolbarButton} onClick={() => insertLiteral('@')}>
            <UserRound size={15} /> {t('editor.toolbar.mention')}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        className={editorStyles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file || !uploadImage) return
          void uploadImage(file).then((src) => {
            editor.update(() => {
              $insertNodes([$createImageNode({ altText: file.name, src })])
            })
          })
        }}
      />
    </div>
  )
}
