import { AutoFocusPlugin as LexicalAutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'

export function AutoFocusPlugin({ enabled = false }: { enabled?: boolean }) {
  if (!enabled) return null
  return <LexicalAutoFocusPlugin />
}
