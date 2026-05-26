import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDocumentAutosave } from './useDocumentAutosave'

afterEach(() => {
  vi.useRealTimers()
})

describe('useDocumentAutosave', () => {
  it('salva uma edicao somente depois do debounce', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue('salvo')
    const onSaved = vi.fn()
    const onStart = vi.fn()
    renderHook(() =>
      useDocumentAutosave({
        ativo: true,
        dirty: true,
        documentKey: 'ideia-1',
        onStart,
        save,
        onSaved,
        onError: vi.fn(),
      }),
    )
    expect(save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(onStart).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
    expect(onSaved).toHaveBeenCalledWith('salvo')
  })

  it('cancela o salvamento pendente ao trocar o documento', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue('salvo')
    const props = {
      ativo: true,
      dirty: true,
      onStart: vi.fn(),
      save,
      onSaved: vi.fn(),
      onError: vi.fn(),
    }
    const { rerender } = renderHook(
      ({ keyValue }) => useDocumentAutosave({ ...props, documentKey: keyValue }),
      { initialProps: { keyValue: 'ideia-1' } },
    )
    rerender({ keyValue: 'ideia-2' })
    await act(async () => vi.advanceTimersByTimeAsync(999))
    expect(save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledOnce()
  })
})
