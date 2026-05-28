import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin'
import { useRef, type RefObject } from 'react'
import type { EditorBreakpoint } from '../hooks/useEditorBreakpoint'
import { editorStyles } from '../theme'
import { DragHandle } from '../ui/DragHandle'
import { TargetLine } from '../ui/TargetLine'

export function DragHandlePlugin({
  anchorRef,
  breakpoint,
}: {
  anchorRef: RefObject<HTMLElement | null>
  breakpoint: EditorBreakpoint
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const targetLineRef = useRef<HTMLDivElement>(null)
  const anchorElem = anchorRef.current

  if (breakpoint === 'mobile' || !anchorElem) return null

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      menuComponent={
        <div ref={menuRef} className={editorStyles.dragHandleMenu}>
          <DragHandle />
        </div>
      }
      targetLineComponent={
        <div ref={targetLineRef} className={editorStyles.targetLineHost}>
          <TargetLine />
        </div>
      }
      isOnMenu={(element) => element.closest('[data-editor-drag-handle]') !== null}
    />
  )
}
