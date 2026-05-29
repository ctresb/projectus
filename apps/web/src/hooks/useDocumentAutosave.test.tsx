import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { markIdle } from './useSaveStatus'
import { useDocumentAutosave } from './useDocumentAutosave'

afterEach(() => {
  vi.useRealTimers()
  markIdle()
})

describe('useDocumentAutosave', () => {
  it('salva uma edicao depois do debounce base', async () => {
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
    await act(async () => vi.advanceTimersByTimeAsync(599))
    expect(save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
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
    const { rerender } = renderHook(({ keyValue }) => useDocumentAutosave({ ...props, documentKey: keyValue }), {
      initialProps: { keyValue: 'ideia-1' },
    })
    rerender({ keyValue: 'ideia-2' })
    await act(async () => vi.advanceTimersByTimeAsync(599))
    expect(save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledOnce()
  })

  it('aborta um save em andamento ao trocar o documento', async () => {
    vi.useFakeTimers()
    const captured: { signal?: AbortSignal } = {}
    const save = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          captured.signal = signal
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const props = {
      ativo: true,
      dirty: true,
      onStart: vi.fn(),
      save,
      onSaved: vi.fn(),
      onError: vi.fn(),
    }
    const { rerender } = renderHook(({ keyValue }) => useDocumentAutosave({ ...props, documentKey: keyValue }), {
      initialProps: { keyValue: 'ideia-1' },
    })
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(save).toHaveBeenCalledOnce()
    rerender({ keyValue: 'ideia-2' })
    expect(captured.signal).toBeDefined()
    expect(captured.signal?.aborted).toBe(true)
    expect(props.onError).not.toHaveBeenCalled()
  })

  it('usa debounce maior quando edicoes chegam muito perto', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue('salvo')
    const props = {
      ativo: true,
      documentKey: 'ideia-1',
      onStart: vi.fn(),
      save,
      onSaved: vi.fn(),
      onError: vi.fn(),
    }
    const { rerender } = renderHook(
      ({ dirty }) =>
        useDocumentAutosave({
          ...props,
          dirty,
          baseDebounceMs: 600,
          maxDebounceMs: 1800,
        }),
      { initialProps: { dirty: true } },
    )
    await act(async () => vi.advanceTimersByTimeAsync(100))
    rerender({ dirty: false })
    rerender({ dirty: true })
    await act(async () => vi.advanceTimersByTimeAsync(1799))
    expect(save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledOnce()
  })

  it('retenta erro transiente e volta para salvo', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce('salvo')
    const onSaved = vi.fn()
    renderHook(() =>
      useDocumentAutosave({
        ativo: true,
        dirty: true,
        documentKey: 'ideia-1',
        onStart: vi.fn(),
        save,
        onSaved,
        onError: vi.fn(),
        baseDebounceMs: 10,
        retryBackoffMs: [20],
      }),
    )
    await act(async () => vi.advanceTimersByTimeAsync(10))
    expect(save).toHaveBeenCalledOnce()
    await act(async () => vi.advanceTimersByTimeAsync(20))
    expect(save).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledWith('salvo')
  })
})
