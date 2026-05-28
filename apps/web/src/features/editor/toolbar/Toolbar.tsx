import { $isCodeNode, CodeNode } from '@lexical/code'
import { $isListNode, ListNode } from '@lexical/list'
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import { $getSelection, $isRangeSelection, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical'
import { useEffect, useState } from 'react'
import type { EditorBreakpoint } from '../hooks/useEditorBreakpoint'
import { DesktopToolbar } from './DesktopToolbar'
import { MobileToolbar } from './MobileToolbar'
import type { BlockType } from './BlockTypeSelect'

export type ToolbarFormats = {
  bold: boolean
  code: boolean
  italic: boolean
  strikethrough: boolean
  underline: boolean
}

export type ToolbarState = {
  blockType: BlockType
  canRedo: boolean
  canUndo: boolean
  formats: ToolbarFormats
}

const initialToolbarState: ToolbarState = {
  blockType: 'paragraph',
  canRedo: false,
  canUndo: false,
  formats: {
    bold: false,
    code: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
}

function detectBlockType(): BlockType {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return 'paragraph'
  const anchorNode = selection.anchor.getNode()
  const topLevel = anchorNode.getTopLevelElementOrThrow()
  const parent = anchorNode.getParent()
  const block = $isListNode(topLevel) ? topLevel : parent instanceof ListNode ? parent : topLevel
  if ($isListNode(block)) {
    const type = block.getListType()
    if (type === 'number') return 'numbered'
    if (type === 'check') return 'check'
    return 'bullet'
  }
  if ($isHeadingNode(block)) {
    const tag = block.getTag()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return tag
  }
  if ($isQuoteNode(block)) return 'quote'
  if ($isCodeNode(block) || block instanceof CodeNode) return 'code'
  return 'paragraph'
}

export function Toolbar({ breakpoint }: { breakpoint: EditorBreakpoint }) {
  const [editor] = useLexicalComposerContext()
  const [state, setState] = useState<ToolbarState>(initialToolbarState)

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection()
            const blockType = detectBlockType()
            const formats = $isRangeSelection(selection)
              ? {
                  bold: selection.hasFormat('bold'),
                  code: selection.hasFormat('code'),
                  italic: selection.hasFormat('italic'),
                  strikethrough: selection.hasFormat('strikethrough'),
                  underline: selection.hasFormat('underline'),
                }
              : initialToolbarState.formats
            setState((current) => ({
              ...current,
              blockType,
              formats,
            }))
          })
        }),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (canUndo) => {
            setState((current) => ({ ...current, canUndo }))
            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (canRedo) => {
            setState((current) => ({ ...current, canRedo }))
            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor],
  )

  return breakpoint === 'mobile' ? <MobileToolbar state={state} /> : <DesktopToolbar state={state} />
}
