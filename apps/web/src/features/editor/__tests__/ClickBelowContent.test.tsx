import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { act, render } from '@testing-library/react'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { createRef, useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { createEditorConfig } from '../editorConfig'
import { ClickBelowContentPlugin } from '../plugins/ClickBelowContentPlugin'

function SeedPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.update(
      () => {
        const root = $getRoot()
        root.clear()
        root.append($createParagraphNode().append($createTextNode('one')))
      },
      { discrete: true },
    )
  }, [editor])
  return null
}

describe('ClickBelowContentPlugin', () => {
  it('moves the caret only when the click is below the last block', () => {
    const wrapperRef = createRef<HTMLDivElement>()
    const { container } = render(
      <div ref={wrapperRef}>
        <LexicalComposer initialConfig={createEditorConfig()}>
          <div contentEditable suppressContentEditableWarning>
            <p>one</p>
          </div>
          <SeedPlugin />
          <ClickBelowContentPlugin wrapperRef={wrapperRef} />
        </LexicalComposer>
      </div>,
    )
    const contentEditable = container.querySelector('[contenteditable="true"]') as HTMLElement
    const paragraph = contentEditable.querySelector('p') as HTMLElement
    Object.defineProperty(contentEditable, 'lastElementChild', { configurable: true, value: paragraph })
    Object.defineProperty(paragraph, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ bottom: 100 } as DOMRect),
    })

    const betweenBlocks = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientY: 80 })
    act(() => {
      contentEditable.dispatchEvent(betweenBlocks)
    })
    expect(betweenBlocks.defaultPrevented).toBe(false)

    const belowContent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientY: 140 })
    act(() => {
      contentEditable.dispatchEvent(belowContent)
    })
    expect(belowContent.defaultPrevented).toBe(true)
  })
})
