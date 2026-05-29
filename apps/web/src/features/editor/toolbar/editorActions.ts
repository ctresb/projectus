import { $createCodeNode } from '@lexical/code'
import { REMOVE_LIST_COMMAND } from '@lexical/list'
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $createParagraphNode, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'

export type CommandActionContext = {
  requestImageUpload?: () => void
}

export function setParagraph(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createParagraphNode())
  })
  editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
}

export function setHeading(editor: LexicalEditor, tag: HeadingTagType) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createHeadingNode(tag))
  })
}

export function setQuote(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode())
  })
}

export function setCode(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createCodeNode('txt'))
  })
}

export function insertText(editor: LexicalEditor, text: string) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) selection.insertText(text)
  })
}
