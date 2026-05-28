import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot } from 'lexical'
import { useEffect, type RefObject } from 'react'

export function ClickBelowContentPlugin({ wrapperRef }: { wrapperRef: RefObject<HTMLElement | null> }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button, input, textarea, select, a, [role="button"], [contenteditable="true"] *')) return
      const contentEditable = wrapper.querySelector<HTMLElement>('[contenteditable="true"]')
      if (!contentEditable) return
      const lastBlock = contentEditable.lastElementChild as HTMLElement | null
      if (!lastBlock) return
      const lastBottom = lastBlock.getBoundingClientRect().bottom
      if (event.clientY <= lastBottom) return
      event.preventDefault()
      event.stopPropagation()
      editor.update(
        () => {
          $getRoot().selectEnd()
        },
        { tag: 'history-merge' },
      )
      editor.focus()
    }

    wrapper.addEventListener('pointerdown', onPointerDown, true)
    return () => wrapper.removeEventListener('pointerdown', onPointerDown, true)
  }, [editor, wrapperRef])

  return null
}
