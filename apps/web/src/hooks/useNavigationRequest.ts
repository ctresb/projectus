import { useEffect, useRef } from 'react'

/**
 * The minimal shape every navigation request shares: a monotonically increasing
 * `token` that changes each time a new navigation is requested. Consumers extend
 * this with their own payload (e.g. an id, a task id, a discriminant).
 */
export type NavigationRequest = { token: number }

/**
 * Handles a navigation request. May be sync or async. Return `false` to signal
 * that the request was *not* consumed (e.g. the target data has not loaded yet),
 * so the same token is retried the next time the effect runs. Returning
 * `undefined`/`true`/anything else marks the token as handled.
 */
export type NavigationRequestHandler<Request extends NavigationRequest> = (
  request: Request,
) => boolean | void | Promise<boolean | void>

/**
 * Runs `handler` exactly once per new request token.
 *
 * Captures the repeated "navigate-on-token" pattern: a navigation request carries
 * a `token`, and a ref remembers the last handled token so the effect fires once
 * per new token and ignores re-renders that keep the same token. Passing a
 * `null`/`undefined` request is a no-op.
 *
 * The handler may bail out by returning `false`, in which case the token is left
 * unhandled and the handler is retried on the next change to `request` (or to any
 * value in `extraDeps`) — useful when the navigation target depends on data that
 * may still be loading.
 *
 * @param request    The current navigation request, or null/undefined when none.
 * @param handler    Invoked once per new token with the (non-null) request.
 * @param extraDeps  Extra reactive dependencies that should re-evaluate a pending
 *                   request without changing its token (e.g. a loaded document).
 */
export function useNavigationRequest<Request extends NavigationRequest>(
  request: Request | null | undefined,
  handler: NavigationRequestHandler<Request>,
  extraDeps: readonly unknown[] = [],
): void {
  const handledToken = useRef<number | null>(null)

  useEffect(() => {
    if (!request || handledToken.current === request.token) return

    const result = handler(request)

    if (result instanceof Promise) {
      // Mark handled optimistically; an async handler cannot retry the same token.
      handledToken.current = request.token
      return
    }

    if (result === false) return
    handledToken.current = request.token
    // `handler` is intentionally omitted from deps: consumers pass an inline
    // closure that changes every render. The token + extraDeps gate execution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.token, request, ...extraDeps])
}
