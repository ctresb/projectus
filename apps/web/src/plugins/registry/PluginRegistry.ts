// The single source of truth for everything plugins contribute to the host.
//
// Core surfaces (Shell, App, global search, the editor, settings, archive)
// consume this registry's getters instead of hard-coding any plugin. A plugin's
// `activate(ctx)` registers `*Contribution` instances here through its scoped
// `PluginContext`; `unregisterPlugin(id)` tears every one of them back down when
// the plugin is disabled. This file is the de-hardcoding hub: it stays a thin,
// kind-keyed store and never names a specific plugin.
//
// Contributions are kept in a `Map<ExtensionPointKind, AnyContribution[]>`.
// Every contribution carries its owning `pluginId` (set by the runtime), so
// `unregisterPlugin` is a clean filter and per-kind getters can return the
// merged, insertion-ordered list across all active plugins. Reads go through
// getters that return an immutable snapshot; React subscribes via
// `subscribe(listener)` (see `useRegistry`) and re-renders whenever any
// contribution set changes.

import type {
  AnyContribution,
  ArchiveIntegrationContribution,
  BackgroundJobContribution,
  CardActionContribution,
  CardBadgeContribution,
  CommandContribution,
  ContributionMap,
  EditorNodeContribution,
  EditorTransformerContribution,
  ExtensionPointKind,
  I18nContribution,
  NavItemContribution,
  ScreenContribution,
  SearchProviderContribution,
  SettingsPanelContribution,
  ShortcutContribution,
  SlashCommandContribution,
  ToolbarItemContribution,
} from '../types/extension-points'

/// Every extension-point kind, in a fixed order. Used to seed the store and to
/// iterate uniformly (e.g. when collecting `all()` for the conflict detector).
const EXTENSION_POINT_KINDS = [
  'navItem',
  'screen',
  'settingsPanel',
  'editorNode',
  'editorTransformer',
  'slashCommand',
  'toolbarItem',
  'searchProvider',
  'cardBadge',
  'cardAction',
  'archiveIntegration',
  'command',
  'shortcut',
  'backgroundJob',
  'i18n',
] as const satisfies readonly ExtensionPointKind[]

/// A read-only view of the registry at a point in time. The same object
/// reference is returned by `snapshot()` until the next mutation, so
/// `useSyncExternalStore` stays stable and React only re-renders on real change.
export interface RegistrySnapshot {
  readonly navItems: readonly NavItemContribution[]
  readonly screens: readonly ScreenContribution[]
  readonly settingsPanels: readonly SettingsPanelContribution[]
  readonly editorNodes: readonly EditorNodeContribution[]
  readonly editorTransformers: readonly EditorTransformerContribution[]
  readonly slashCommands: readonly SlashCommandContribution[]
  readonly toolbarItems: readonly ToolbarItemContribution[]
  readonly searchProviders: readonly SearchProviderContribution[]
  readonly cardBadges: readonly CardBadgeContribution[]
  readonly cardActions: readonly CardActionContribution[]
  readonly archiveIntegrations: readonly ArchiveIntegrationContribution[]
  readonly commands: readonly CommandContribution[]
  readonly shortcuts: readonly ShortcutContribution[]
  readonly backgroundJobs: readonly BackgroundJobContribution[]
  readonly i18nDictionaries: readonly I18nContribution[]
}

/// `order` then insertion order; missing `order` sorts after explicit ones.
function byOrder<T extends { order?: number }>(a: T, b: T): number {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER
  const bo = b.order ?? Number.MAX_SAFE_INTEGER
  return ao - bo
}

export class PluginRegistry {
  /// Contributions grouped by extension-point kind, in registration order.
  private readonly store = new Map<ExtensionPointKind, AnyContribution[]>()

  /// React subscribers notified on every mutation.
  private readonly listeners = new Set<() => void>()

  /// Cached immutable snapshot; invalidated (set to `null`) on any mutation and
  /// rebuilt lazily by `snapshot()`. Keeping a stable reference between
  /// mutations is what lets `useSyncExternalStore` avoid render loops.
  private cachedSnapshot: RegistrySnapshot | null = null

  constructor() {
    for (const kind of EXTENSION_POINT_KINDS) {
      this.store.set(kind, [])
    }
  }

  // --- Generic plumbing ----------------------------------------------------

  /// Append a contribution under its kind. Internal: typed `register*` methods
  /// below are the public surface so callers cannot mismatch kind and shape.
  private add<K extends ExtensionPointKind>(kind: K, contribution: ContributionMap[K]): void {
    const list = this.store.get(kind)
    if (!list) return
    list.push(contribution)
    this.invalidate()
  }

  /// Drop the cached snapshot and notify subscribers. Called after every change.
  private invalidate(): void {
    this.cachedSnapshot = null
    this.listeners.forEach((listener) => listener())
  }

  /// Raw, kind-keyed read used by generic consumers (e.g. the conflict
  /// detector) that want to iterate every contribution uniformly.
  contributions<K extends ExtensionPointKind>(kind: K): readonly ContributionMap[K][] {
    return (this.store.get(kind) ?? []) as ContributionMap[K][]
  }

  /// Flat list of every contribution across all kinds, in kind order. Handy for
  /// `detectConflicts`, which keys on per-kind fields itself.
  all(): readonly AnyContribution[] {
    const out: AnyContribution[] = []
    for (const kind of EXTENSION_POINT_KINDS) {
      const list = this.store.get(kind)
      if (list) out.push(...list)
    }
    return out
  }

  // --- Typed registration --------------------------------------------------

  registerNavItem(contribution: NavItemContribution): void {
    this.add('navItem', contribution)
  }

  registerScreen(contribution: ScreenContribution): void {
    this.add('screen', contribution)
  }

  registerSettingsPanel(contribution: SettingsPanelContribution): void {
    this.add('settingsPanel', contribution)
  }

  registerEditorNode(contribution: EditorNodeContribution): void {
    this.add('editorNode', contribution)
  }

  registerEditorTransformer(contribution: EditorTransformerContribution): void {
    this.add('editorTransformer', contribution)
  }

  registerSlashCommand(contribution: SlashCommandContribution): void {
    this.add('slashCommand', contribution)
  }

  registerToolbarItem(contribution: ToolbarItemContribution): void {
    this.add('toolbarItem', contribution)
  }

  registerSearchProvider(contribution: SearchProviderContribution): void {
    this.add('searchProvider', contribution)
  }

  registerCardBadge(contribution: CardBadgeContribution): void {
    this.add('cardBadge', contribution)
  }

  registerCardAction(contribution: CardActionContribution): void {
    this.add('cardAction', contribution)
  }

  registerArchiveIntegration(contribution: ArchiveIntegrationContribution): void {
    this.add('archiveIntegration', contribution)
  }

  registerCommand(contribution: CommandContribution): void {
    this.add('command', contribution)
  }

  registerShortcut(contribution: ShortcutContribution): void {
    this.add('shortcut', contribution)
  }

  registerBackgroundJob(contribution: BackgroundJobContribution): void {
    this.add('backgroundJob', contribution)
  }

  registerI18n(contribution: I18nContribution): void {
    this.add('i18n', contribution)
  }

  // --- Teardown ------------------------------------------------------------

  /// Remove every contribution owned by `pluginId` across all kinds. The host
  /// calls this when a plugin is disabled/uninstalled; combined with the
  /// scoped registrar in `PluginContext`, plugin teardown is a clean filter.
  unregisterPlugin(pluginId: string): void {
    let changed = false
    for (const kind of EXTENSION_POINT_KINDS) {
      const list = this.store.get(kind)
      if (!list || list.length === 0) continue
      const next = list.filter((contribution) => contribution.pluginId !== pluginId)
      if (next.length !== list.length) {
        this.store.set(kind, next)
        changed = true
      }
    }
    if (changed) this.invalidate()
  }

  // --- Getters (sorted, immutable) -----------------------------------------

  navItems(): readonly NavItemContribution[] {
    return [...this.contributions('navItem')].sort(byOrder)
  }

  screens(): readonly ScreenContribution[] {
    return [...this.contributions('screen')]
  }

  settingsPanels(): readonly SettingsPanelContribution[] {
    return [...this.contributions('settingsPanel')].sort(byOrder)
  }

  editorNodes(): readonly EditorNodeContribution[] {
    return [...this.contributions('editorNode')]
  }

  editorTransformers(): readonly EditorTransformerContribution[] {
    return [...this.contributions('editorTransformer')]
  }

  slashCommands(): readonly SlashCommandContribution[] {
    return [...this.contributions('slashCommand')]
  }

  toolbarItems(): readonly ToolbarItemContribution[] {
    return [...this.contributions('toolbarItem')].sort(byOrder)
  }

  searchProviders(): readonly SearchProviderContribution[] {
    return [...this.contributions('searchProvider')]
  }

  cardBadges(): readonly CardBadgeContribution[] {
    return [...this.contributions('cardBadge')]
  }

  cardActions(): readonly CardActionContribution[] {
    return [...this.contributions('cardAction')].sort(byOrder)
  }

  archiveIntegrations(): readonly ArchiveIntegrationContribution[] {
    return [...this.contributions('archiveIntegration')]
  }

  commands(): readonly CommandContribution[] {
    return [...this.contributions('command')]
  }

  shortcuts(): readonly ShortcutContribution[] {
    return [...this.contributions('shortcut')]
  }

  backgroundJobs(): readonly BackgroundJobContribution[] {
    return [...this.contributions('backgroundJob')]
  }

  i18nDictionaries(): readonly I18nContribution[] {
    return [...this.contributions('i18n')]
  }

  // --- React integration ---------------------------------------------------

  /// A stable, immutable view of every contribution set. The same reference is
  /// returned until the next mutation, so `useSyncExternalStore` does not loop.
  snapshot(): RegistrySnapshot {
    if (this.cachedSnapshot) return this.cachedSnapshot
    const snapshot: RegistrySnapshot = {
      navItems: this.navItems(),
      screens: this.screens(),
      settingsPanels: this.settingsPanels(),
      editorNodes: this.editorNodes(),
      editorTransformers: this.editorTransformers(),
      slashCommands: this.slashCommands(),
      toolbarItems: this.toolbarItems(),
      searchProviders: this.searchProviders(),
      cardBadges: this.cardBadges(),
      cardActions: this.cardActions(),
      archiveIntegrations: this.archiveIntegrations(),
      commands: this.commands(),
      shortcuts: this.shortcuts(),
      backgroundJobs: this.backgroundJobs(),
      i18nDictionaries: this.i18nDictionaries(),
    }
    this.cachedSnapshot = snapshot
    return snapshot
  }

  /// Subscribe to mutations. Returns an unsubscribe fn. Drives `useRegistry`.
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

/// The process-wide registry instance shared by the host. The `PluginHost`
/// provider exposes it through context; non-React modules (search index,
/// shortcut manager) import it directly.
export const pluginRegistry = new PluginRegistry()
