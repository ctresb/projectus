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
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type Translation,
} from '@mdxeditor/editor'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'

type Props = {
  documentKey: string
  markdown: string
  onChange: (markdown: string) => void
  uploadImage?: (file: File) => Promise<string>
}

export type MarkdownEditorHandle = {
  focus: () => void
}

const translations: Record<string, string> = {
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
}
const translate: Translation = (key, fallback, interpolations = {}) =>
  Object.entries(interpolations).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    translations[key] ?? fallback,
  )

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { documentKey, markdown, onChange, uploadImage },
  ref,
) {
  const editorRef = useRef<MDXEditorMethods>(null)
  const previousDocument = useRef(documentKey)
  const uploadImageRef = useRef(uploadImage)
  uploadImageRef.current = uploadImage
  useImperativeHandle(ref, () => ({ focus: () => editorRef.current?.focus() }), [])
  useEffect(() => {
    if (previousDocument.current === documentKey) return
    previousDocument.current = documentKey
    editorRef.current?.setMarkdown(markdown)
  }, [documentKey, markdown])
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
      codeMirrorPlugin({ codeBlockLanguages: { txt: 'Texto', ts: 'TypeScript', rust: 'Rust', json: 'JSON' } }),
      diffSourcePlugin({ viewMode: 'rich-text' }),
      imagePlugin({
        imageUploadHandler: async (file) => {
          if (!uploadImageRef.current) throw new Error('envio de imagem indisponível neste editor')
          return uploadImageRef.current(file)
        },
      }),
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
    [],
  )
  return (
    <div className="markdown-editor">
      <MDXEditor
        ref={editorRef}
        className="projectus-mdx"
        markdown={markdown}
        onChange={onChange}
        placeholder="escreva em markdown..."
        translation={translate}
        contentEditableClassName="markdown-editor__content"
        plugins={plugins}
      />
    </div>
  )
})
