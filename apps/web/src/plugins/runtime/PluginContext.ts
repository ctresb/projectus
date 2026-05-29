// The capability object a plugin receives in `activate(ctx)`.
//
// `PluginContext` is the *only* surface a plugin uses to touch the host: it
// contributes UI/editor/search/etc. through scoped registrars, reads/writes its
// own namespaced data store, registers locale dictionaries and keyboard
// shortcuts. It is the runtime counterpart to the static `PluginRegistry`: every
// registrar here stamps the owning plugin id onto the contribution before
// forwarding it to the registry, so `unregisterPlugin(id)` on disable is a clean
// filter and a plugin can never spoof another plugin's id.
//
// Every capability is permission-gated. The context is built from a manifest;
// each registrar/method first runs `assertPermission(manifest, …)` for the
// permission that surface gates on (the same extension-point → permission map
// the conflict detector mirrors), so an undeclared capability throws at the
// moment it is used rather than doing privileged work silently.
//
// Core stays plugin-agnostic: this file names no plugin id and invents no new
// primitive — it reuses the existing `PluginRegistry`, `PluginStorageClient`,
// the i18n `Locale`/`Dictionary` types, and the manifest/permission types.

import type {
  ArchiveIntegrationContribution,
  BackgroundJobContribution,
  CardActionContribution,
  CardBadgeContribution,
  CommandContribution,
  EditorNodeContribution,
  EditorTransformerContribution,
  I18nContribution,
  NavItemContribution,
  ScreenContribution,
  SearchProviderContribution,
  SettingsPanelContribution,
  ShortcutContribution,
  SlashCommandContribution,
  ToolbarItemContribution,
} from '../types/extension-points'
import type { PluginManifest } from '../types/manifest'
import { PluginRegistry, pluginRegistry } from '../registry/PluginRegistry'
import { PluginStorageClient } from '../storage/PluginStorageClient'
import { assertPermission, hasPermission } from '../permissions/checkPermission'

/// A contribution as a plugin supplies it: the runtime owns `pluginId` (it stamps
/// the manifest id so unregister stays clean), so plugins never pass it. They
/// still provide a plugin-unique `id` for each contribution slot.
type Authored<C> = Omit<C, 'pluginId'>

/// The scoped contribution surface. Each method takes an `Authored<…>`
/// contribution (no `pluginId`), is gated on the surface's permission, stamps
/// the owning plugin id, and forwards it to the shared registry. Mirrors the
/// `PluginRegistry.register*` methods one-to-one.
export interface PluginContributions {
  addNavItem(contribution: Authored<NavItemContribution>): void
  addScreen(contribution: Authored<ScreenContribution>): void
  addSettingsPanel(contribution: Authored<SettingsPanelContribution>): void
  addEditorNode(contribution: Authored<EditorNodeContribution>): void
  addEditorTransformer(contribution: Authored<EditorTransformerContribution>): void
  addSlashCommand(contribution: Authored<SlashCommandContribution>): void
  addToolbarItem(contribution: Authored<ToolbarItemContribution>): void
  addSearchProvider(contribution: Authored<SearchProviderContribution>): void
  addCardBadge(contribution: Authored<CardBadgeContribution>): void
  addCardAction(contribution: Authored<CardActionContribution>): void
  addArchiveIntegration(contribution: Authored<ArchiveIntegrationContribution>): void
  addCommand(contribution: Authored<CommandContribution>): void
  addBackgroundJob(contribution: Authored<BackgroundJobContribution>): void
}

/// The scoped i18n registrar. `register` merges the plugin's per-locale
/// dictionaries into the host's, namespaced by the plugin id at the call site of
/// the consuming surface. i18n has no single gating permission (it is ambient
/// to any UI a plugin contributes), so it is not permission-gated here — it
/// mirrors the conflict detector's `requiredPermission` returning `null` for
/// i18n contributions.
export interface PluginI18n {
  register(contribution: Authored<I18nContribution>): void
}

/// The scoped shortcut registrar. `register` records a shortcut *into the
/// registry*; the host's `ShortcutManager` owns the single global keydown
/// listener and reads the registry's `shortcuts()` to dispatch. Gated on
/// `shortcuts:register`, so a plugin cannot bind keys it did not declare. This
/// replaces the ad-hoc `window.addEventListener('keydown', …)` plugins used to
/// reach for.
export interface PluginShortcuts {
  register(contribution: Authored<ShortcutContribution>): void
}

/// The full capability object handed to `activate(ctx)`.
export interface PluginContext {
  /// The owning plugin's manifest id (read-only; convenience for the plugin).
  readonly pluginId: string
  /// The validated manifest the host loaded this plugin from.
  readonly manifest: PluginManifest
  /// Scoped contribution registrars (nav, screen, editor, search, archive, …).
  readonly contributes: PluginContributions
  /// Scoped locale-dictionary registrar.
  readonly i18n: PluginI18n
  /// Scoped keyboard-shortcut registrar (the only sanctioned keydown path).
  readonly shortcuts: PluginShortcuts
  /// True if the manifest declares `permission`. For permission-aware UI; the
  /// registrars enforce the gate regardless.
  has(permission: PluginManifest['permissions'][number]): boolean
  /// The plugin's namespaced data store, scoped to its id. Lazily created on
  /// first access and gated on `file:storage`: a plugin that did not declare the
  /// permission throws when it touches `ctx.storage`.
  readonly storage: PluginStorageClient
}

/// Build the capability object for one plugin. `manifest` is the validated
/// manifest (its `id` is the unregister key the runtime later filters on);
/// `registry` defaults to the process-wide shared instance and is injectable for
/// tests. Returns the `PluginContext` the loader passes to `activate(ctx)`.
export function createPluginContext(
  manifest: PluginManifest,
  registry: PluginRegistry = pluginRegistry,
): PluginContext {
  const pluginId = manifest.id

  /// Stamp the owning plugin id onto an authored contribution. This is the one
  /// place `pluginId` is set, so a plugin can neither omit nor forge it and
  /// `unregisterPlugin(pluginId)` cleanly removes everything this context added.
  const stamp = <C extends { id: string }>(contribution: C): C & { pluginId: string } => ({
    ...contribution,
    pluginId,
  })

  const contributes: PluginContributions = {
    addNavItem(contribution) {
      assertPermission(manifest, 'screens:add')
      registry.registerNavItem(stamp(contribution))
    },
    addScreen(contribution) {
      assertPermission(manifest, 'screens:add')
      registry.registerScreen(stamp(contribution))
    },
    addSettingsPanel(contribution) {
      assertPermission(manifest, 'settings:add')
      registry.registerSettingsPanel(stamp(contribution))
    },
    addEditorNode(contribution) {
      assertPermission(manifest, 'editor:extend')
      registry.registerEditorNode(stamp(contribution))
    },
    addEditorTransformer(contribution) {
      assertPermission(manifest, 'editor:extend')
      registry.registerEditorTransformer(stamp(contribution))
    },
    addSlashCommand(contribution) {
      assertPermission(manifest, 'editor:extend')
      registry.registerSlashCommand(stamp(contribution))
    },
    addToolbarItem(contribution) {
      assertPermission(manifest, 'editor:extend')
      registry.registerToolbarItem(stamp(contribution))
    },
    addSearchProvider(contribution) {
      assertPermission(manifest, 'search:provide')
      registry.registerSearchProvider(stamp(contribution))
    },
    addCardBadge(contribution) {
      // Card badges decorate existing host cards; no single gating permission
      // (mirrors the conflict detector's `requiredPermission` => null).
      registry.registerCardBadge(stamp(contribution))
    },
    addCardAction(contribution) {
      // Card actions likewise have no single gating permission.
      registry.registerCardAction(stamp(contribution))
    },
    addArchiveIntegration(contribution) {
      assertPermission(manifest, 'archive:create')
      registry.registerArchiveIntegration(stamp(contribution))
    },
    addCommand(contribution) {
      assertPermission(manifest, 'commands:register')
      registry.registerCommand(stamp(contribution))
    },
    addBackgroundJob(contribution) {
      assertPermission(manifest, 'background-jobs')
      registry.registerBackgroundJob(stamp(contribution))
    },
  }

  const i18n: PluginI18n = {
    register(contribution) {
      registry.registerI18n(stamp(contribution))
    },
  }

  const shortcuts: PluginShortcuts = {
    register(contribution) {
      assertPermission(manifest, 'shortcuts:register')
      registry.registerShortcut(stamp(contribution))
    },
  }

  // The storage client is built once on first access and gated on
  // `file:storage`, so reaching for `ctx.storage` without the permission throws.
  let storageClient: PluginStorageClient | null = null

  return {
    pluginId,
    manifest,
    contributes,
    i18n,
    shortcuts,
    has(permission) {
      return hasPermission(manifest, permission)
    },
    get storage(): PluginStorageClient {
      assertPermission(manifest, 'file:storage')
      if (!storageClient) {
        storageClient = new PluginStorageClient(pluginId)
      }
      return storageClient
    },
  }
}
