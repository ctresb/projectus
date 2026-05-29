import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuickCreate } from './useQuickCreate'

describe('useQuickCreate', () => {
  it('abre o compositor com o primeiro caractere digitado', () => {
    const onNovo = vi.fn()
    renderHook(() => useQuickCreate({ ativo: true, onNovo }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    expect(onNovo).toHaveBeenCalledWith('f')
  })

  it('abre um item vazio com command+n', () => {
    const onNovo = vi.fn()
    renderHook(() => useQuickCreate({ ativo: true, onNovo }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true }))
    expect(onNovo).toHaveBeenCalledWith('')
  })

  it('nao intercepta digitacao em campos', () => {
    const onNovo = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    renderHook(() => useQuickCreate({ ativo: true, onNovo }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
    expect(onNovo).not.toHaveBeenCalled()
  })
})
