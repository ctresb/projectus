import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useFloatingPosition } from '../hooks/useFloatingPosition'
import { FloatingToolbar } from '../toolbar/FloatingToolbar'
import type { ToolbarFormats } from '../toolbar/Toolbar'

const emptyFormats: ToolbarFormats = {
  bold: false,
  code: false,
  italic: false,
  strikethrough: false,
  underline: false,
}

export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [formats, setFormats] = useState<ToolbarFormats>(emptyFormats)
  const style = useFloatingPosition(rect, toolbarRef)

  useEffect(() => {
    const update = () => {
      const rootElement = editor.getRootElement()
      if (!rootElement) {
        setRect(null)
        return
      }
      editor.getEditorState().read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          setRect(null)
          return
        }
        const domSelection = window.getSelection()
        if (!domSelection || domSelection.rangeCount === 0) {
          setRect(null)
          return
        }
        const anchorNode = domSelection.anchorNode
        const focusNode = domSelection.focusNode
        if (!anchorNode || !focusNode || !rootElement.contains(anchorNode) || !rootElement.contains(focusNode)) {
          setRect(null)
          return
        }
        const rangeRect = domSelection.getRangeAt(0).getBoundingClientRect()
        if (rangeRect.width === 0 && rangeRect.height === 0) {
          setRect(null)
          return
        }
        setFormats({
          bold: selection.hasFormat('bold'),
          code: selection.hasFormat('code'),
          italic: selection.hasFormat('italic'),
          strikethrough: selection.hasFormat('strikethrough'),
          underline: selection.hasFormat('underline'),
        })
        setRect(rangeRect)
      })
    }

    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        update()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          setRect(null)
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  useEffect(
    () =>
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          window.setTimeout(() => setRect(null), 250)
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  useEffect(() => {
    const hideWhenOutsideEditor = (event?: PointerEvent) => {
      const rootElement = editor.getRootElement()
      const target = event?.target as Node | null
      if (target && (rootElement?.contains(target) || toolbarRef.current?.contains(target))) return
      const domSelection = window.getSelection()
      if (
        !rootElement ||
        !domSelection ||
        !domSelection.anchorNode ||
        !domSelection.focusNode ||
        !rootElement.contains(domSelection.anchorNode) ||
        !rootElement.contains(domSelection.focusNode)
      ) {
        setRect(null)
      }
    }
    const onPointerDown = (event: PointerEvent) => hideWhenOutsideEditor(event)
    const onSelectionChange = () => hideWhenOutsideEditor()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [editor])

  if (!rect) return null
  return createPortal(
    <div ref={toolbarRef} style={style}>
      <FloatingToolbar formats={formats} />
    </div>,
    document.body,
  )
}
