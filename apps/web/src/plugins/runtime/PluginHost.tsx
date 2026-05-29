// The React provider that boots and runs the plugin subsystem.
//
// `PluginHost` is the runtime that ties every other plugin module together. On
// mount it:
//   1. fetches the installed list from the backend (`pluginApi.list`),
//   2. asks `detectConflicts` which plugins must not activate (integrity
//      mismatch, API too new, declared conflict, a disabled permission),
//   3. loads + activates every *enabled, non-fatally-conflicted* plugin through
//      `loadPluginModule` + `createPluginContext`, so each plugin's contributions
//      land in the shared `PluginRegistry`,
//   4. re-runs `detectConflicts` against the now-live contributions to surface
//      slot/shortcut/screen/node warnings for the settings UI,
//   5. starts the single global `ShortcutManager` and keeps it in sync with the
//      registry's shortcut contributions.
//
// It then exposes the registry snapshot and an `enable(id)`/`disable(id)`
// lifecycle through React context (`usePluginHost`). Enable/disable take effect
// with NO restart: enabling tells the backend, reloads the row, activates the
// module, and re-renders every consumer through the registry subscription;
// disabling deactivates the module, unregisters its contributions, and frees its
// shortcuts. Shell, App, the editor, search, settings and archive read the
// registry getters (via `useRegistry` / this provider) and therefore react live.
//
// Core stays plugin-agnostic: this file names no plugin id. Builtins are resolved
// through `loader` (the one place ids appear, in `builtinRegistry`); the native
// reserved surface is derived from the host primitives passed in as props, so the
// host's real nav/nodes drive conflict detection without the provider hard-coding
// a builtin.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { pluginApi } from '../lib/pluginApi'
import type { InstalledPlugin } from '../lib/pluginApi'
import {
  detectConflicts,
  type ConflictDetectionInput,
  type DisabledPermissions,
  type InstalledPluginInput,
  type NativeBaseline,
  type PluginConflict,
} from '../conflicts/detectConflicts'
import { createPluginContext } from './PluginContext'
import { installExternalPluginRuntime } from './externalHostRuntime'
import { loadPluginModule, type LoadablePlugin, type PluginModule } from './loader'
import { shortcutManager, NATIVE_SHORTCUT_KEYS, type ShortcutManager } from './ShortcutManager'
import { pluginRegistry, type PluginRegistry, type RegistrySnapshot } from '../registry/PluginRegistry'
import { useRegistry } from '../registry/useRegistry'

// --- Public context shape --------------------------------------------------

/// What `usePluginHost` exposes to the rest of the app. `snapshot` is the live
/// registry view (also available via `useRegistry`); `plugins` is the raw
/// backend list; `conflicts` is the latest report; `status` reflects the boot
/// lifecycle; `enable`/`disable`/`refresh` drive the no-restart lifecycle.
export interface PluginHostValue {
  /// Boot/runtime status of the host itself.
  readonly status: PluginHostStatus
  /// The current immutable registry snapshot (re-renders consumers on change).
  readonly snapshot: RegistrySnapshot
  /// The installed-plugin rows as returned by the backend.
  readonly plugins: readonly InstalledPlugin[]
  /// The latest conflict report (fatal + warning), recomputed on every change.
  readonly conflicts: readonly PluginConflict[]
  /// A boot/lifecycle error message, if any (e.g. the list fetch failed).
  readonly error: string | null
  /// Enable a plugin on the backend, then load + activate it in place.
  enable(id: string): Promise<void>
  /// Disable a plugin on the backend, then deactivate + unregister it in place.
  disable(id: string): Promise<void>
  /// Re-fetch the installed list and re-reconcile activations (no restart).
  refresh(): Promise<void>
}

/// The host's boot lifecycle. `idle` before mount work begins, `loading` while
/// the first list fetch + activation pass runs, `ready` once reconciled, `error`
/// if the initial fetch failed (the app still renders; plugins are just absent).
export type PluginHostStatus = 'idle' | 'loading' | 'ready' | 'error'

const PluginHostContext = createContext<PluginHostValue | null>(null)

/// Access the plugin host. Throws when used outside `<PluginHost>` so a missing
/// provider is a loud setup bug rather than a silent `null`.
export function usePluginHost(): PluginHostValue {
  const value = useContext(PluginHostContext)
  if (!value) {
    throw new Error('usePluginHost must be used within a <PluginHost> provider.')
  }
  return value
}

// --- Props -----------------------------------------------------------------

/// The host's native reserved surface, supplied by the app at the call site so
/// the provider stays plugin-agnostic. The app derives these from its live Shell
/// nav, `nodeRegistry`, editor toolbar and native keybindings. Optional: omitted
/// fields fall back to empty (and `apiVersion` to the backend's current 7), so a
/// minimal mount still works while a fuller baseline tightens conflict checks.
export interface PluginHostNative extends Partial<Omit<NativeBaseline, 'apiVersion'>> {
  apiVersion?: number
}

export interface PluginHostProps {
  children: ReactNode
  /// The host's reserved surface for conflict detection. Defaults to the bare
  /// native shortcut baseline and the current host API version.
  native?: PluginHostNative
  /// Per-plugin permissions the user has switched off. Defaults to none.
  disabledPermissions?: DisabledPermissions
  /// Injectable for tests; defaults to the process-wide shared registry.
  registry?: PluginRegistry
  /// Injectable for tests; defaults to the process-wide shortcut manager.
  shortcuts?: ShortcutManager
}

/// The host's current API version when the app does not supply one. Mirrors the
/// backend `API_VERSION` (currently 7). The app should pass the real value it
/// reads from bootstrap when available; this is the safe default.
const DEFAULT_API_VERSION = 7

/// Stable empty default so `disabledPermissions ?? EMPTY_DISABLED` keeps a
/// referentially-stable object across renders (avoids re-running memos).
const EMPTY_DISABLED: DisabledPermissions = {}

// --- Internal bookkeeping --------------------------------------------------

/// A live, activated plugin the host is tracking so it can deactivate cleanly.
interface ActivePlugin {
  id: string
  module: PluginModule
}

/// Project an `InstalledPlugin` row into the `detectConflicts` input shape (it is
/// a structural subset, so this is a field pick, not a transform).
function toConflictInput(plugin: InstalledPlugin): InstalledPluginInput {
  return {
    manifest: plugin.manifest,
    state: plugin.state,
    source: plugin.source,
    trust: plugin.trust,
  }
}

/// Project a row into the loader's `LoadablePlugin` shape.
function toLoadable(plugin: InstalledPlugin): LoadablePlugin {
  return { manifest: plugin.manifest, source: plugin.source }
}

// --- Provider --------------------------------------------------------------

export function PluginHost({
  children,
  native,
  disabledPermissions,
  registry = pluginRegistry,
  shortcuts = shortcutManager,
}: PluginHostProps): ReactNode {
  const [status, setStatus] = useState<PluginHostStatus>('idle')
  const [plugins, setPlugins] = useState<readonly InstalledPlugin[]>([])
  const [conflicts, setConflicts] = useState<readonly PluginConflict[]>([])
  const [error, setError] = useState<string | null>(null)

  // The live registry snapshot. Subscribing here re-renders the whole subtree
  // (and the value exposed via context) whenever any contribution set changes,
  // which is exactly what makes enable/disable take effect without a restart.
  const snapshot = useRegistry(registry)

  // Modules currently activated, keyed by plugin id, so disable() can find and
  // run the right `deactivate()`. A ref (not state) because mutating it must not
  // by itself trigger a render — the registry subscription drives renders.
  const activeRef = useRef<Map<string, ActivePlugin>>(new Map())

  // The native baseline used for conflict detection. Memoized on the relevant
  // inputs so detectConflicts gets a stable object across renders.
  const nativeBaseline = useMemo<NativeBaseline>(
    () => ({
      // The host's reserved accelerators (`mod+k`/`mod+n`) are baked into the
      // ShortcutManager; reuse the same baseline so the detector and the manager
      // agree on what collides. The app may pass a fuller list.
      shortcutKeys: native?.shortcutKeys ?? NATIVE_SHORTCUT_KEYS,
      // `screenIds` MUST contain only TRUE native screens (the app passes
      // `projetos/arquivo/backup/config/plugins`); a plugin screen id is never
      // native, so it defaults to empty rather than to any plugin route. A
      // plugin contributing both a screen and a nav item for its OWN id is not a
      // conflict — the detector treats same-plugin claims as self.
      screenIds: native?.screenIds ?? [],
      editorNodeNames: native?.editorNodeNames ?? [],
      toolbarSlots: native?.toolbarSlots ?? [],
      apiVersion: native?.apiVersion ?? DEFAULT_API_VERSION,
    }),
    [native],
  )

  const disabled = disabledPermissions ?? EMPTY_DISABLED

  // --- Conflict computation -------------------------------------------------

  /// Run the detector over a plugin list + the current live contributions. Pure
  /// read of the registry's flat contribution list; no mutation.
  const computeConflicts = useCallback(
    (rows: readonly InstalledPlugin[]): PluginConflict[] => {
      const input: ConflictDetectionInput = {
        plugins: rows.map(toConflictInput),
        contributions: registry.all(),
        native: nativeBaseline,
        disabledPermissions: disabled,
      }
      return detectConflicts(input)
    },
    [registry, nativeBaseline, disabled],
  )

  /// The set of plugin ids that have a FATAL conflict and therefore must not be
  /// activated. Warning-level conflicts (duplicate slot/shortcut/etc.) do not
  /// block activation — the registry's first-claim ordering picks the winner —
  /// so only `severity: 'fatal'` gates here.
  const fatallyBlocked = useCallback(
    (rows: readonly InstalledPlugin[]): Set<string> => {
      const blocked = new Set<string>()
      // For the pre-activation gate we only have manifests, so we run the
      // detector with an empty contribution list: every fatal pass (integrity,
      // api-version, declared-conflict, permission-disabled) is manifest-only.
      const input: ConflictDetectionInput = {
        plugins: rows.map(toConflictInput),
        contributions: [],
        native: nativeBaseline,
        disabledPermissions: disabled,
      }
      for (const conflict of detectConflicts(input)) {
        if (conflict.severity === 'fatal') blocked.add(conflict.pluginId)
      }
      return blocked
    },
    [nativeBaseline, disabled],
  )

  // --- Activation primitives -----------------------------------------------

  /// Load + activate one plugin row, registering its contributions and tracking
  /// it for later teardown. No-op if already active. Surfaces (does not swallow)
  /// activation failures so the caller can report them.
  const activatePlugin = useCallback(
    async (plugin: InstalledPlugin): Promise<void> => {
      if (activeRef.current.has(plugin.manifest.id)) return
      const module = await loadPluginModule(toLoadable(plugin))
      const ctx = createPluginContext(plugin.manifest, registry)
      await module.activate(ctx)
      activeRef.current.set(plugin.manifest.id, { id: plugin.manifest.id, module })
    },
    [registry],
  )

  /// Deactivate one plugin: run its optional `deactivate()`, then unregister all
  /// its contributions and free its shortcut bindings. Always tears down the
  /// registry/shortcuts even if `deactivate()` throws, so a misbehaving plugin
  /// cannot leak contributions.
  const deactivatePlugin = useCallback(
    async (id: string): Promise<void> => {
      const active = activeRef.current.get(id)
      activeRef.current.delete(id)
      try {
        if (active?.module.deactivate) {
          await active.module.deactivate()
        }
      } finally {
        registry.unregisterPlugin(id)
        shortcuts.unregisterPlugin(id)
      }
    },
    [registry, shortcuts],
  )

  // --- Reconciliation -------------------------------------------------------

  /// Bring the live activation set in line with `rows`: activate every enabled,
  /// non-fatally-conflicted plugin that is not yet active; deactivate every
  /// active plugin that is no longer enabled (or now disabled/removed). Then
  /// recompute the conflict report against the resulting live contributions.
  const reconcile = useCallback(
    async (rows: readonly InstalledPlugin[]): Promise<void> => {
      const blocked = fatallyBlocked(rows)
      const desired = new Map<string, InstalledPlugin>()
      for (const row of rows) {
        if (row.state === 'enabled' && !blocked.has(row.manifest.id)) {
          desired.set(row.manifest.id, row)
        }
      }

      // Deactivate anything active that is no longer desired.
      for (const id of [...activeRef.current.keys()]) {
        if (!desired.has(id)) {
          await deactivatePlugin(id)
        }
      }

      // Activate everything desired that is not yet active. Failures are
      // isolated per plugin so one bad module does not block the rest.
      for (const [id, row] of desired) {
        if (activeRef.current.has(id)) continue
        try {
          await activatePlugin(row)
        } catch (cause) {
          // eslint-disable-next-line no-console
          console.error(`Failed to activate plugin "${id}":`, cause)
        }
      }

      setConflicts(computeConflicts(rows))
    },
    [fatallyBlocked, deactivatePlugin, activatePlugin, computeConflicts],
  )

  /// Fetch the installed list and reconcile activations against it.
  const refresh = useCallback(async (): Promise<void> => {
    const response = await pluginApi.list()
    const rows = response.plugins
    setPlugins(rows)
    await reconcile(rows)
  }, [reconcile])

  // --- Boot -----------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    // Publish the host React bridge BEFORE loading any external plugin, so a
    // zip/url plugin's contributed screen can render against the host React.
    installExternalPluginRuntime()
    // The single global keydown listener for plugin shortcuts. Idempotent.
    shortcuts.start()

    setStatus('loading')
    setError(null)
    void (async () => {
      try {
        const response = await pluginApi.list()
        if (cancelled) return
        const rows = response.plugins
        setPlugins(rows)
        await reconcile(rows)
        if (!cancelled) setStatus('ready')
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
    // Boot once on mount. `reconcile`/`shortcuts` are stable for the host's
    // lifetime; re-running on every change would re-fetch the list needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the global ShortcutManager in sync with the registry's shortcut
  // contributions: a plugin registers a shortcut through `ctx.shortcuts.register`
  // (which lands in the registry); the manager owns the actual keydown listener,
  // so the host bridges the registry's `shortcuts` list into manager bindings.
  // Re-runs whenever the snapshot changes (i.e. on any enable/disable).
  useEffect(() => {
    const desired = new Map<string, (typeof snapshot.shortcuts)[number]>()
    for (const contribution of snapshot.shortcuts) {
      desired.set(`${contribution.pluginId}:${contribution.id}`, contribution)
    }

    // Register any shortcut contribution the manager is not yet carrying. The
    // manager refuses collisions itself, so a duplicate accelerator is simply
    // not bound (the conflict is already in the report).
    for (const contribution of desired.values()) {
      shortcuts.register({
        pluginId: contribution.pluginId,
        id: contribution.id,
        keys: contribution.keys,
        run: contribution.run,
      })
    }
    // No per-key teardown here: contributions are removed from the registry by
    // `unregisterPlugin`, and `deactivatePlugin` calls `shortcuts.unregisterPlugin`
    // for the same id, so disabled plugins' bindings are already freed.
  }, [snapshot.shortcuts, shortcuts])

  // Recompute conflicts when the live contribution set changes (e.g. a plugin
  // activated and registered slots), so warning-level collisions surface without
  // a re-fetch. Reads `plugins` from state; the registry's `all()` is live.
  useEffect(() => {
    if (plugins.length === 0) return
    setConflicts(computeConflicts(plugins))
  }, [snapshot, plugins, computeConflicts])

  // --- Lifecycle actions ----------------------------------------------------

  const enable = useCallback(
    async (id: string): Promise<void> => {
      // Backend is the durable writer + verification authority: it refuses to
      // enable a `mismatch` plugin, surfaced as an `ApiFailure`. On success we
      // re-fetch (the row's trust/state may have changed) and reconcile, which
      // loads + activates the now-enabled plugin in place.
      await pluginApi.enable(id)
      await refresh()
    },
    [refresh],
  )

  const disable = useCallback(
    async (id: string): Promise<void> => {
      await pluginApi.disable(id)
      // Deactivate locally first so the UI updates immediately, then re-fetch to
      // reconcile the authoritative state.
      await deactivatePlugin(id)
      await refresh()
    },
    [deactivatePlugin, refresh],
  )

  const value = useMemo<PluginHostValue>(
    () => ({ status, snapshot, plugins, conflicts, error, enable, disable, refresh }),
    [status, snapshot, plugins, conflicts, error, enable, disable, refresh],
  )

  return <PluginHostContext.Provider value={value}>{children}</PluginHostContext.Provider>
}
