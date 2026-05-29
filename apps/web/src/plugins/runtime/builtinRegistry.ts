// The map of builtin plugin ids to their dynamic ESM imports.
//
// Builtin plugins ship inside the host bundle (under `plugins/builtin/<id>/`)
// and are code-split via `import()` so an enabled builtin is fetched lazily,
// exactly like an external plugin's served ESM entry. The host's
// `runtime/loader.ts` consults this map first: an installed plugin whose
// `source === 'builtin'` is loaded through its entry here; everything else is
// imported from the backend-served URL.
//
// This is the *one* place a builtin plugin id is named. Core surfaces (Shell,
// App, search, editor, settings, archive) never reference a plugin — they read
// the `PluginRegistry`. Adding a builtin is a single new entry below; removing
// one is a single deletion. The map is `Readonly` so the registry cannot be
// mutated at runtime.

import type { PluginModule } from './loader'

/// A lazy importer for one builtin plugin's ESM module. Returns the module's
/// default-or-named `activate`/`deactivate` surface, matching what `import()` of
/// an external plugin's entry yields, so `loadPluginModule` treats both
/// uniformly.
export type BuiltinImporter = () => Promise<PluginModule>

/// Builtin id → dynamic import. Each value is a thunk so Vite code-splits the
/// builtin into its own chunk and only fetches it when the plugin is enabled.
///
/// The `notes` plugin lives entirely under `plugins/builtin/notes/` (the Ideas
/// feature, renamed per spec); its `index.ts` exports `activate(ctx)` and an
/// optional `deactivate()`.
export const builtinRegistry = {
  // The Notes builtin lives entirely under `plugins/builtin/notes/`; its
  // `index.ts` exports `activate(ctx)` and `deactivate()`. Vite code-splits this
  // dynamic import into its own chunk, fetched only when the plugin is enabled.
  notes: () => import('../builtin/notes') as Promise<PluginModule>,
} as const satisfies Record<string, BuiltinImporter>

/// The set of ids the host ships as builtins. Used by the loader to decide
/// whether an installed plugin resolves through `builtinRegistry`.
export type BuiltinPluginId = keyof typeof builtinRegistry

/// True when `id` names a builtin plugin the host bundles. Narrows `id` to
/// `BuiltinPluginId` so `builtinRegistry[id]` is a safe indexed access.
export function isBuiltinPluginId(id: string): id is BuiltinPluginId {
  return Object.prototype.hasOwnProperty.call(builtinRegistry, id)
}
