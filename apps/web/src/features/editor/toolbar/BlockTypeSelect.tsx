import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical'
import { Select } from '../../../components/ui'
import { editorStyles } from '../theme'

export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code' | 'bullet' | 'numbered' | 'check'

function setBlock(editor: ReturnType<typeof useLexicalComposerContext>[0], blockType: BlockType) {
  if (blockType === 'bullet') {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    return
  }
  if (blockType === 'numbered') {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    return
  }
  if (blockType === 'check') {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
    return
  }
  editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
  editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    if (blockType === 'paragraph') $setBlocksType(selection, () => $createParagraphNode())
    if (blockType === 'h1') $setBlocksType(selection, () => $createHeadingNode('h1'))
    if (blockType === 'h2') $setBlocksType(selection, () => $createHeadingNode('h2'))
    if (blockType === 'h3') $setBlocksType(selection, () => $createHeadingNode('h3'))
    if (blockType === 'quote') $setBlocksType(selection, () => $createQuoteNode())
    if (blockType === 'code') $setBlocksType(selection, () => $createCodeNode('txt'))
  })
}

export function BlockTypeSelect({ blockType, labels }: { blockType: BlockType; labels: Record<BlockType, string> }) {
  const [editor] = useLexicalComposerContext()
  const options: Array<{ value: BlockType; label: string }> = [
    { value: 'paragraph', label: labels.paragraph },
    { value: 'h1', label: labels.h1 },
    { value: 'h2', label: labels.h2 },
    { value: 'h3', label: labels.h3 },
    { value: 'quote', label: labels.quote },
    { value: 'code', label: labels.code },
    { value: 'bullet', label: labels.bullet },
    { value: 'numbered', label: labels.numbered },
    { value: 'check', label: labels.check },
  ]
  return (
    <Select
      className={editorStyles.blockSelect}
      value={blockType}
      label={labels.paragraph}
      options={options}
      onChange={(value) => setBlock(editor, value as BlockType)}
    />
  )
}
