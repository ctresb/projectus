import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNavigationRequest, type NavigationRequest } from './useNavigationRequest'

type Request = NavigationRequest & { id: string }

describe('useNavigationRequest', () => {
  it('fires the handler on a new token', () => {
    const handler = vi.fn()
    renderHook(({ request }) => useNavigationRequest(request, handler), {
      initialProps: { request: { id: 'a', token: 1 } as Request },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ id: 'a', token: 1 })
  })

  it('does not re-fire for the same token across re-renders', () => {
    const handler = vi.fn()
    const { rerender } = renderHook(({ request }) => useNavigationRequest(request, handler), {
      initialProps: { request: { id: 'a', token: 1 } as Request },
    })

    // Same token, new object identity (mirrors App.tsx rebuilding the request each render).
    rerender({ request: { id: 'a', token: 1 } })
    rerender({ request: { id: 'b', token: 1 } })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires again when the token changes', () => {
    const handler = vi.fn()
    const { rerender } = renderHook(({ request }) => useNavigationRequest(request, handler), {
      initialProps: { request: { id: 'a', token: 1 } as Request },
    })

    rerender({ request: { id: 'a', token: 2 } })
    rerender({ request: { id: 'a', token: 2 } })
    rerender({ request: { id: 'a', token: 3 } })

    expect(handler).toHaveBeenCalledTimes(3)
    expect(handler).toHaveBeenNthCalledWith(1, { id: 'a', token: 1 })
    expect(handler).toHaveBeenNthCalledWith(2, { id: 'a', token: 2 })
    expect(handler).toHaveBeenNthCalledWith(3, { id: 'a', token: 3 })
  })

  it('is a no-op for null requests', () => {
    const handler = vi.fn()
    const { rerender } = renderHook(
      ({ request }: { request: Request | null }) => useNavigationRequest(request, handler),
      { initialProps: { request: null as Request | null } },
    )

    rerender({ request: null })
    expect(handler).not.toHaveBeenCalled()

    // Once a real token arrives, it fires.
    rerender({ request: { id: 'a', token: 1 } })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for undefined requests', () => {
    const handler = vi.fn()
    renderHook(({ request }: { request: Request | undefined }) => useNavigationRequest(request, handler), {
      initialProps: { request: undefined },
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('retries the same token when the handler returns false (request not yet consumable)', () => {
    let ready = false
    const handler = vi.fn(() => ready)

    const { rerender } = renderHook(
      ({ request, dep }: { request: Request; dep: boolean }) => useNavigationRequest(request, handler, [dep]),
      { initialProps: { request: { id: 'a', token: 1 } as Request, dep: false } },
    )

    // First pass: not consumable, token stays unhandled.
    expect(handler).toHaveBeenCalledTimes(1)

    // Data loads -> extraDep changes -> retried for the same token, now consumed.
    ready = true
    rerender({ request: { id: 'a', token: 1 }, dep: true })
    expect(handler).toHaveBeenCalledTimes(2)

    // Subsequent re-renders with the same token no longer re-fire.
    rerender({ request: { id: 'a', token: 1 }, dep: true })
    expect(handler).toHaveBeenCalledTimes(2)
  })
})
