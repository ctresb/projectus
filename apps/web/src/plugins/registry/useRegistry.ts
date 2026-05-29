// React binding for the `PluginRegistry`.
//
// `useRegistry` subscribes a component to the registry through
// `useSyncExternalStore`, returning the current immutable snapshot. Because the
// registry caches its snapshot and only produces a new reference on mutation
// (see `PluginRegistry.snapshot`), the equality check in `useSyncExternalStore`
// is referential and components re-render exactly when a plugin is
// enabled/disabled or otherwise changes its contributions — no polling, no loop.
//
// This is what lets Shell, App, and the global search index stay live across
// plugin enable/disable without a restart, while still consuming only the
// registry's getters (never a hard-coded plugin).

import { useSyncExternalStore } from 'react'
import { pluginRegistry, type PluginRegistry, type RegistrySnapshot } from './PluginRegistry'

/// Subscribe to a registry and return its current snapshot. Defaults to the
/// shared `pluginRegistry`; a different instance can be passed for tests.
export function useRegistry(registry: PluginRegistry = pluginRegistry): RegistrySnapshot {
  return useSyncExternalStore(
    (listener) => registry.subscribe(listener),
    () => registry.snapshot(),
    () => registry.snapshot(),
  )
}
