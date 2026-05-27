import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertImage,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  realmPlugin,
  rootEditor$,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type Translation,
} from '@mdxeditor/editor'
import { $getRoot } from 'lexical'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type MutableRefObject,
  type PointerEvent,
} from 'react'
import { useLocale, useT, type Locale } from '../../i18n'

type Props = {
  documentKey: string
  markdown: string
  onChange: (markdown: string) => void
  uploadImage?: (file: File) => Promise<string>
}

export type MarkdownEditorHandle = {
  focus: () => void
}

const mdxTranslations: Record<Locale, Record<string, string>> = {
  'pt-BR': {
  'contentArea.editableMarkdown': 'descrição em markdown',
  'toolbar.undo': 'Desfazer {{shortcut}}',
  'toolbar.redo': 'Refazer {{shortcut}}',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Tipo de bloco',
  'toolbar.blockTypeSelect.placeholder': 'Bloco',
  'toolbar.blockTypes.paragraph': 'Parágrafo',
  'toolbar.blockTypes.quote': 'Citação',
  'toolbar.blockTypes.heading': 'Título {{level}}',
  'toolbar.bold': 'Negrito',
  'toolbar.removeBold': 'Remover negrito',
  'toolbar.italic': 'Itálico',
  'toolbar.removeItalic': 'Remover itálico',
  'toolbar.underline': 'Sublinhado',
  'toolbar.removeUnderline': 'Remover sublinhado',
  'toolbar.bulletedList': 'Lista',
  'toolbar.numberedList': 'Lista numerada',
  'toolbar.checkList': 'Checklist',
  'toolbar.toggleGroup': 'grupo de opções',
  'toolbar.link': 'Criar link',
  'toolbar.image': 'Inserir imagem',
  'toolbar.table': 'Inserir tabela',
  'toolbar.codeBlock': 'Inserir bloco de código',
  'toolbar.thematicBreak': 'Inserir separador',
  'toolbar.richText': 'Texto rico',
  'toolbar.source': 'Markdown',
  'dialog.close': 'Fechar',
  'createLink.url': 'URL',
  'createLink.urlPlaceholder': 'Cole uma URL',
  'createLink.textTooltip': 'Texto exibido pelo link',
  'createLink.text': 'Texto do link',
  'createLink.titleTooltip': 'Título exibido ao passar o cursor',
  'createLink.title': 'Título do link',
  'createLink.saveTooltip': 'Salvar link',
  'createLink.cancelTooltip': 'Cancelar alteração',
  'dialogControls.save': 'salvar',
  'dialogControls.cancel': 'cancelar',
  'linkPreview.open': 'Abrir {{url}} em nova janela',
  'linkPreview.edit': 'Editar URL do link',
  'linkPreview.copyToClipboard': 'Copiar para a área de transferência',
  'linkPreview.copied': 'Copiado',
  'linkPreview.remove': 'Remover link',
  'uploadImage.dialogTitle': 'Inserir imagem',
  'uploadImage.uploadInstructions': 'Enviar imagem do dispositivo:',
  'uploadImage.addViaUrlInstructions': 'Ou adicionar imagem por URL:',
  'uploadImage.addViaUrlInstructionsNoUpload': 'Adicionar imagem por URL:',
  'uploadImage.autoCompletePlaceholder': 'Cole a URL da imagem',
  'uploadImage.alt': 'Texto alternativo:',
  'uploadImage.title': 'Título:',
  'uploadImage.width': 'Largura:',
  'uploadImage.height': 'Altura:',
  'table.deleteTable': 'Remover tabela',
  'table.columnMenu': 'Opções da coluna',
  'table.textAlignment': 'Alinhamento do texto',
  'table.alignLeft': 'Alinhar à esquerda',
  'table.alignCenter': 'Centralizar',
  'table.alignRight': 'Alinhar à direita',
  'table.insertColumnLeft': 'Inserir coluna à esquerda',
  'table.insertColumnRight': 'Inserir coluna à direita',
  'table.deleteColumn': 'Remover coluna',
  'table.rowMenu': 'Opções da linha',
  'table.insertRowAbove': 'Inserir linha acima',
  'table.insertRowBelow': 'Inserir linha abaixo',
  'table.deleteRow': 'Remover linha',
  },
  'en-US': {
    'contentArea.editableMarkdown': 'markdown description',
    'toolbar.undo': 'Undo {{shortcut}}',
    'toolbar.redo': 'Redo {{shortcut}}',
    'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Block type',
    'toolbar.blockTypeSelect.placeholder': 'Block',
    'toolbar.blockTypes.paragraph': 'Paragraph',
    'toolbar.blockTypes.quote': 'Quote',
    'toolbar.blockTypes.heading': 'Heading {{level}}',
    'toolbar.bold': 'Bold',
    'toolbar.removeBold': 'Remove bold',
    'toolbar.italic': 'Italic',
    'toolbar.removeItalic': 'Remove italic',
    'toolbar.underline': 'Underline',
    'toolbar.removeUnderline': 'Remove underline',
    'toolbar.bulletedList': 'List',
    'toolbar.numberedList': 'Numbered list',
    'toolbar.checkList': 'Checklist',
    'toolbar.toggleGroup': 'option group',
    'toolbar.link': 'Create link',
    'toolbar.image': 'Insert image',
    'toolbar.table': 'Insert table',
    'toolbar.codeBlock': 'Insert code block',
    'toolbar.thematicBreak': 'Insert separator',
    'toolbar.richText': 'Rich text',
    'toolbar.source': 'Markdown',
    'dialog.close': 'Close',
    'createLink.url': 'URL',
    'createLink.urlPlaceholder': 'Paste a URL',
    'createLink.textTooltip': 'Text displayed by the link',
    'createLink.text': 'Link text',
    'createLink.titleTooltip': 'Title displayed on hover',
    'createLink.title': 'Link title',
    'createLink.saveTooltip': 'Save link',
    'createLink.cancelTooltip': 'Cancel change',
    'dialogControls.save': 'save',
    'dialogControls.cancel': 'cancel',
    'linkPreview.open': 'Open {{url}} in a new window',
    'linkPreview.edit': 'Edit link URL',
    'linkPreview.copyToClipboard': 'Copy to clipboard',
    'linkPreview.copied': 'Copied',
    'linkPreview.remove': 'Remove link',
    'uploadImage.dialogTitle': 'Insert image',
    'uploadImage.uploadInstructions': 'Upload image from device:',
    'uploadImage.addViaUrlInstructions': 'Or add image by URL:',
    'uploadImage.addViaUrlInstructionsNoUpload': 'Add image by URL:',
    'uploadImage.autoCompletePlaceholder': 'Paste image URL',
    'uploadImage.alt': 'Alternative text:',
    'uploadImage.title': 'Title:',
    'uploadImage.width': 'Width:',
    'uploadImage.height': 'Height:',
    'table.deleteTable': 'Remove table',
    'table.columnMenu': 'Column options',
    'table.textAlignment': 'Text alignment',
    'table.alignLeft': 'Align left',
    'table.alignCenter': 'Center',
    'table.alignRight': 'Align right',
    'table.insertColumnLeft': 'Insert column left',
    'table.insertColumnRight': 'Insert column right',
    'table.deleteColumn': 'Remove column',
    'table.rowMenu': 'Row options',
    'table.insertRowAbove': 'Insert row above',
    'table.insertRowBelow': 'Insert row below',
    'table.deleteRow': 'Remove row',
  },
}

function createTranslate(locale: Locale): Translation {
  return (key, fallback, interpolations = {}) =>
    Object.entries(interpolations).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      mdxTranslations[locale][key] ?? fallback,
    )
}

const placeCaretAtEndPlugin = realmPlugin<{ placeCaretAtEnd: MutableRefObject<() => void> }>({
  init(realm, params) {
    if (!params) return
    params.placeCaretAtEnd.current = () => {
      const editor = realm.getValue(rootEditor$)
      if (!editor) return
      editor.update(() => {
        $getRoot().selectEnd()
      }, { discrete: true })
      editor.focus()
    }
  },
})

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { documentKey, markdown, onChange, uploadImage },
  ref,
) {
  const locale = useLocale()
  const t = useT()
  const editorRef = useRef<MDXEditorMethods>(null)
  const placeCaretAtEnd = useRef<() => void>(() => editorRef.current?.focus(undefined, { defaultSelection: 'rootEnd' }))
  const previousDocument = useRef(documentKey)
  const uploadImageRef = useRef(uploadImage)
  uploadImageRef.current = uploadImage
  useImperativeHandle(ref, () => ({ focus: () => editorRef.current?.focus() }), [])
  useEffect(() => {
    if (previousDocument.current === documentKey) return
    previousDocument.current = documentKey
    editorRef.current?.setMarkdown(markdown)
  }, [documentKey, markdown])
  const translate = useMemo(() => createTranslate(locale), [locale])
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      markdownShortcutPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({ codeBlockLanguages: { txt: locale === 'en-US' ? 'Text' : 'Texto', ts: 'TypeScript', rust: 'Rust', json: 'JSON' } }),
      diffSourcePlugin({ viewMode: 'rich-text' }),
      imagePlugin({
        imageUploadHandler: async (file) => {
          if (!uploadImageRef.current) throw new Error(t('markdown.image_unavailable'))
          return uploadImageRef.current(file)
        },
      }),
      placeCaretAtEndPlugin({ placeCaretAtEnd }),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={['rich-text', 'source']}>
            <UndoRedo />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <ListsToggle options={['check']} />
            <ListsToggle options={['bullet', 'number']} />
            <CreateLink />
            <InsertImage />
            <InsertTable />
            <InsertThematicBreak />
            <InsertCodeBlock />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [locale, t],
  )
  const focusBlankSurface = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (
      target.closest(
        'button, input, textarea, select, a, .cm-editor, [role="combobox"], [role="dialog"]',
      )
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    placeCaretAtEnd.current()
  }
  return (
    <div className="markdown-editor" onPointerDownCapture={focusBlankSurface}>
      <MDXEditor
        ref={editorRef}
        className="projectus-mdx"
        markdown={markdown}
        onChange={onChange}
        placeholder={t('markdown.placeholder')}
        translation={translate}
        contentEditableClassName="markdown-editor__content"
        plugins={plugins}
      />
    </div>
  )
})
