import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalIsTextContentEmpty } from '@lexical/react/useLexicalIsTextContentEmpty'

export function EmptyStatePlugin() {
  const [editor] = useLexicalComposerContext()
  useLexicalIsTextContentEmpty(editor)
  return null
}
