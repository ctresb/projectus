import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from 'lexical'
import { useEffect } from 'react'

export function PastePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (event instanceof ClipboardEvent) {
            const html = event.clipboardData?.getData('text/html')
            if (html) {
              return false
            }
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  return null
}
