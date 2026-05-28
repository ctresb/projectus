import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { createEditor } from 'lexical'
import { describe, expect, it } from 'vitest'
import { nodeRegistry } from '../nodes/nodeRegistry'
import { EXTENDED_TRANSFORMERS } from '../transformers'

function roundtrip(markdown: string) {
  const editor = createEditor({
    namespace: 'test',
    nodes: nodeRegistry,
    onError: (error) => {
      throw error
    },
  })
  editor.update(
    () => {
      $convertFromMarkdownString(markdown, EXTENDED_TRANSFORMERS, undefined, false)
    },
    { discrete: true },
  )
  return editor.getEditorState().read(() => $convertToMarkdownString(EXTENDED_TRANSFORMERS, undefined, false))
}

describe('markdown roundtrip', () => {
  it('preserves custom wikilinks, mentions, and images', () => {
    expect(roundtrip('[[idea-1|Idea one]] and @[Alice](mention:user-1)\n\n![alt](/conteudo/img.png)')).toBe(
      '[[idea-1|Idea one]] and @[Alice](mention:user-1)\n\n![alt](/conteudo/img.png)',
    )
  })

  it('preserves checklist markdown', () => {
    expect(roundtrip('- [ ] first\n- [x] second')).toBe('- [ ] first\n- [x] second')
  })
})
