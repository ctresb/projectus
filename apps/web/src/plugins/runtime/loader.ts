// Loads a plugin's ESM module so the host can `activate(ctx)` it.
//
// Two load paths, one uniform result:
//   - builtin (`source === 'builtin'`): resolved through `builtinRegistry`, a
//     static map of `id → () => import('../builtin/<id>')`. Vite code-splits
//     each builtin into its own chunk, fetched only when enabled.
//   - external (`source === 'zip' | 'url'`): the backend extracts the package to
//     `plugins/<id>/<version>/` and serves it as static assets. We dynamically
//     `import()` the served ESM entry URL. The `/* @vite-ignore */` annotation
//     tells the bundler this specifier is a runtime value, not a build-time
//     module to pre-bundle.
//
// SECURITY: external code is loaded with the *native* ESM loader (`import()` of
// a URL) — never `eval`, never `new Function`, never a blob built from source
// text. The backend is the integrity authority: it pins each package's SHA-256
// (mirrored client-side by `signing/integrity.ts`) and refuses to enable a
// `mismatch` plugin. This loader therefore assumes the host has already cleared
// the plugin through `detectConflicts` (which consumes that verdict) before
// asking it to load. The loader does not — and must not — re-derive trust.
//
// Isolation today is the `DirectModuleSandbox`: the plugin module shares the
// host realm and is trusted at the module boundary, capability-gated only by the
// `PluginContext` it receives. `IframeSandbox` is a documented stub for a future
// realm-isolated execution model; the `PluginSandbox` interface is the seam both
// implementations satisfy so the loader's callers do not change when isolation
// is hardened.
//
// Core stays plugin-agnostic: the only place a builtin id appears is
// `builtinRegistry`; this file names no plugin.

import { apiBase } from '../../lib/api'
import { builtinRegistry, isBuiltinPluginId } from './builtinRegistry'
import type { PluginManifest } from '../types/manifest'

// --- The activation contract ----------------------------------------------

/// The capability object the host hands a plugin at activation. The concrete
/// implementation (scoped registry registrar + storage client + i18n/shortcut
/// registrars, every method permission-gated) lives in `runtime/PluginContext`,
/// a later phase. The loader only needs to *carry* it to `activate`, so it is
/// referenced here as an opaque type — `unknown` — to avoid coupling the loader
/// to the context's evolving shape while keeping it strictly typed.
///
/// `PluginContext.ts` will export the real interface; modules that author or
/// consume a context import it from there. Within the loader the value is never
/// inspected, only forwarded.
export type PluginActivationContext = unknown

/// The ESM surface every plugin module exposes. `activate` runs when the plugin
/// is enabled; the optional `deactivate` runs when it is disabled, before the
/// host calls `registry.unregisterPlugin(id)`. Both may be async.
///
/// A module may export these as named exports or under a default export object;
/// `loadPluginModule` normalizes both into this shape.
export interface PluginModule {
  activate: (ctx: PluginActivationContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

/// The subset of a backend `/api/plugins` row the loader needs: which plugin to
/// load (`manifest`) and where it came from (`source`). The host passes its row
/// straight through; extra fields (state, trust, installed_at) are ignored here
/// because trust gating happens upstream in `detectConflicts`.
export interface LoadablePlugin {
  manifest: PluginManifest
  source: 'builtin' | 'zip' | 'url'
}

// --- Sandbox seam ----------------------------------------------------------

/// The execution-isolation strategy used to obtain a plugin's module. Two
/// implementations exist: the in-realm `DirectModuleSandbox` (current) and the
/// realm-isolated `IframeSandbox` (future stub). The loader programs against
/// this interface so swapping isolation models never touches callers.
export interface PluginSandbox {
  /// A stable name for diagnostics/logging.
  readonly kind: 'direct-module' | 'iframe'

  /// Resolve a builtin plugin's module via its registered dynamic import.
  loadBuiltin(id: string): Promise<unknown>

  /// Resolve an external plugin's module from a backend-served ESM URL.
  loadExternal(url: string): Promise<unknown>

  /// Release any resources the sandbox holds for a plugin (e.g. tear down an
  /// iframe). A no-op for the direct sandbox, where the realm is shared.
  dispose?(id: string): void
}

/// Current isolation model: the plugin module is loaded into the host realm with
/// the native loader and trusted at the module boundary. Capability isolation is
/// provided entirely by the permission-gated `PluginContext`, not by realm
/// separation. Builtins resolve through `builtinRegistry`; externals through a
/// `@vite-ignore` dynamic `import()` of the served URL. No `eval`.
export class DirectModuleSandbox implements PluginSandbox {
  readonly kind = 'direct-module' as const

  async loadBuiltin(id: string): Promise<unknown> {
    if (!isBuiltinPluginId(id)) {
      throw new Error(`No builtin plugin registered for id "${id}".`)
    }
    return builtinRegistry[id]()
  }

  async loadExternal(url: string): Promise<unknown> {
    // Native ESM dynamic import of the host-served entry URL. `@vite-ignore`
    // keeps Vite from trying to resolve this runtime URL at build time. This is
    // the ONLY way external plugin code is brought in — never `eval`.
    return import(/* @vite-ignore */ url)
  }
}

/// FUTURE (stub): realm-isolated execution. The plugin module would run inside a
/// sandboxed `<iframe>` (its own realm/globals), communicating with the host
/// over `postMessage`, so a plugin cannot reach the host's globals, DOM, or
/// other plugins directly — only through the explicit capability bridge.
///
/// Not yet implemented: wiring an iframe message bus, marshalling the
/// `PluginContext` capabilities across the realm boundary, and proxying React
/// contributions is substantial. The class exists now so the `PluginSandbox`
/// seam is real and the migration is additive. Its methods reject clearly.
export class IframeSandbox implements PluginSandbox {
  readonly kind = 'iframe' as const

  async loadBuiltin(_id: string): Promise<unknown> {
    throw new Error('IframeSandbox is not implemented yet; use DirectModuleSandbox.')
  }

  async loadExternal(_url: string): Promise<unknown> {
    throw new Error('IframeSandbox is not implemented yet; use DirectModuleSandbox.')
  }

  dispose(_id: string): void {
    // No-op until the iframe lifecycle exists.
  }
}

/// The sandbox the host uses today. Swapped for `IframeSandbox` once realm
/// isolation lands — the only edit needed to harden isolation, since the loader
/// and its callers depend on `PluginSandbox`, not the concrete class.
export const defaultSandbox: PluginSandbox = new DirectModuleSandbox()

// --- URL resolution --------------------------------------------------------

/// Build the absolute ESM URL for an external plugin's entry. The plugins router
/// is nested under `/api/plugins`, and its static `ServeDir` fallback serves each
/// installed package's extracted tree at
/// `${apiBase}/api/plugins/<id>/<version>/<file>`. `manifest.frontend_entry` is
/// the entry file path relative to that tree (e.g. `index.js`). `apiBase` is the
/// daemon ORIGIN (no `/api`) — `''` on an http(s) page (same-origin) and the
/// daemon origin otherwise, matching `lib/api` — so the `/api` prefix is added
/// here (mirroring `apiRequest`, which prepends `/api` to its path).
export function externalEntryUrl(manifest: PluginManifest): string {
  const id = encodeURIComponent(manifest.id)
  const version = encodeURIComponent(manifest.version)
  // `frontend_entry` may contain `/` segments; encode each segment but keep the
  // separators so a nested entry path resolves correctly.
  const entry = manifest.frontend_entry
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${apiBase}/api/plugins/${id}/${version}/${entry}`
}

// --- Loading ---------------------------------------------------------------

/// Load a plugin's module and normalize it to a `PluginModule`.
///
/// Builtins go through `sandbox.loadBuiltin(id)`; externals through
/// `sandbox.loadExternal(externalEntryUrl(manifest))`. The raw module is then
/// normalized: an `activate` may be a named export or sit on a `default` export
/// object. Throws if no callable `activate` can be found, so the host surfaces a
/// clear activation failure instead of silently no-oping.
export async function loadPluginModule(
  installed: LoadablePlugin,
  sandbox: PluginSandbox = defaultSandbox,
): Promise<PluginModule> {
  const { manifest, source } = installed
  const raw =
    source === 'builtin'
      ? await sandbox.loadBuiltin(manifest.id)
      : await sandbox.loadExternal(externalEntryUrl(manifest))

  const module = normalizePluginModule(raw)
  if (!module) {
    throw new Error(
      `Plugin "${manifest.id}" did not export an activate() function (checked named and default exports).`,
    )
  }
  return module
}

// --- Internals -------------------------------------------------------------

/// Coerce a freshly imported module namespace into a `PluginModule`, accepting
/// either named `activate`/`deactivate` exports or a `default` export object
/// carrying them. Returns `null` when no callable `activate` is present.
function normalizePluginModule(raw: unknown): PluginModule | null {
  const fromNamed = readModule(raw)
  if (fromNamed) return fromNamed

  // Fall back to a default export object (e.g. `export default { activate }`).
  if (isRecord(raw) && 'default' in raw) {
    const fromDefault = readModule((raw as { default: unknown }).default)
    if (fromDefault) return fromDefault
  }
  return null
}

/// Extract `{ activate, deactivate? }` from a candidate object when `activate`
/// is callable; otherwise `null`. `deactivate` is carried through only when it
/// too is a function.
function readModule(candidate: unknown): PluginModule | null {
  if (!isRecord(candidate)) return null
  const activate = candidate.activate
  if (typeof activate !== 'function') return null
  const deactivate = candidate.deactivate
  return {
    activate: activate as PluginModule['activate'],
    deactivate: typeof deactivate === 'function' ? (deactivate as PluginModule['deactivate']) : undefined,
  }
}

/// Narrow an `unknown` to an indexable record without a cast at the call site.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
