import { describe, expect, it } from 'vitest'
import { markdownBody } from './markdown'

describe('markdownBody', () => {
  it('oculta o titulo estrutural antes de editar a descricao', () => {
    expect(markdownBody('# Projeto\n\n- [ ] item\n')).toBe('- [ ] item\n')
  })

  it('preserva markdown sem heading gerenciado', () => {
    expect(markdownBody('- [x] feito')).toBe('- [x] feito')
  })
})
