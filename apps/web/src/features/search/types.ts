export type SearchScreen = 'projetos' | 'arquivo' | 'backup' | 'config'

export type GlobalSearchKind = 'project' | 'task' | 'archive' | 'screen' | 'plugin'

export type SearchNavigationTarget =
  | { type: 'project'; projectId: string }
  | { type: 'task'; projectId: string; taskId: string }
  | { type: 'archive'; archiveId: string }
  | { type: 'screen'; screen: SearchScreen }
  | { type: 'plugin'; pluginId: string; screen: string; focus?: string }

export type GlobalSearchTag = {
  id: string
  title: string
  color: string
}

export type GlobalSearchEntry = {
  id: string
  kind: GlobalSearchKind
  title: string
  location: string
  description?: string
  color?: string
  tags?: GlobalSearchTag[]
  updatedAt?: string
  searchText: string
  scopeText: string
  projectScopeId?: string
  action: SearchNavigationTarget
}

export type SearchScopeToken = {
  raw: string
  label: string
  color?: string
}

/// The context the host passes to a search provider's `entries(ctx)` at index
/// time. Carries the current workspace snapshot and the live translator so a
/// provider builds entries from the present state on every rebuild — never from a
/// stale module global only populated when its screen happens to be mounted.
/// Imported as `import('../../i18n').TFn` to avoid pulling a React module into
/// the type-only `extension-points` contract.
export type SearchProviderContext = {
  /// The current workspace snapshot (config, board, plugin-owned slices like
  /// `notes`). Domain fields stay Portuguese (`notas`, `titulo`, …).
  workspace: import('../../lib/types').Bootstrap
  /// The live translator for localized labels in entry/scope text.
  t: import('../../i18n').TFn
}

/// The slice of a plugin's `SearchProviderContribution` the core search index
/// consumes. Core stays plugin-agnostic: it aggregates these structurally via
/// `registry.searchProviders()` and never names any individual plugin.
export type SearchProvider = {
  /// Produce search entries for the current workspace snapshot. Receives a
  /// `SearchProviderContext` so the provider reads the live workspace directly
  /// rather than a module global that only its screen populates.
  entries: (ctx: SearchProviderContext) => GlobalSearchEntry[]
  /// Extra scope aliases (e.g. `{ note: ['plugin'], notas: ['plugin'] }`),
  /// merged into the host `SCOPE_ALIASES` map.
  scopeAliases?: Record<string, GlobalSearchKind[]>
  /// Colors keyed by kind, merged into the host `SCOPE_KIND_COLORS` map.
  colors?: Partial<Record<GlobalSearchKind, string>>
}
