import type { InitialConfigType } from '@lexical/react/LexicalComposer'
import { nodeRegistry } from './nodes/nodeRegistry'
import { editorTheme } from './theme'

export function createEditorConfig(): InitialConfigType {
  return {
    editorState: null,
    namespace: 'projectus-md',
    nodes: nodeRegistry,
    onError(error) {
      console.error('[MarkdownEditor]', error)
    },
    theme: editorTheme,
  }
}
