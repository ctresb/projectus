// Typed contribution interfaces — one per extension point the host exposes.
//
// A plugin's `activate(ctx)` registers instances of these into the
// `PluginRegistry`, and core surfaces (Shell, App, search, editor, settings,
// archive) consume the registry's getters instead of hard-coding any plugin.
// This file is the contract between the two halves: it is the *only* place that
// describes the shape of a contribution, so the de-hardcoding hub
// (`registry/PluginRegistry.ts`) stays a thin keyed store.
//
// Every contribution reuses existing host primitives — React nodes, the Lexical
// node/transformer types already used by `features/editor`, the global-search
// types from `features/search/types`, and the i18n `Locale`/`Dictionary`. No new
// editor components or UI primitives are invented here, and no new npm deps are
// pulled in.

import type { ComponentType, ReactNode } from 'react'
import type { Klass, LexicalNode } from 'lexical'
import type { Transformer } from '@lexical/markdown'
import type { Dictionary, Locale } from '../../i18n'
import type {
  GlobalSearchEntry,
  GlobalSearchKind,
  SearchNavigationTarget,
  SearchProviderContext,
} from '../../features/search/types'

/// Fields every contribution shares: the owning plugin id (so the registry can
/// scope and cleanly `unregisterPlugin`) and a stable, plugin-unique slot id.
export interface BaseContribution {
  /// The id of the plugin that owns this contribution. Set by the runtime when
  /// it scopes the `PluginContext` registrar; plugins do not pass it themselves.
  pluginId: string
  /// Identifier unique within the owning plugin for this contribution.
  id: string
}

// --- Navigation & screens --------------------------------------------------

/// A left-rail navigation entry. Mirrors the existing Shell `nav` item shape
/// (`{ id, label, icon }`) so the registry's `navItems()` can be rendered the
/// same way the builtin nav array is.
export interface NavItemContribution extends BaseContribution {
  /// Already-resolved label (the plugin runs the i18n `t` itself).
  label: string
  /// A lucide-react icon component, matching the Shell's `icon` slot.
  icon: ComponentType<{ size?: number | string }>
  /// The screen id this entry navigates to (matches a `ScreenContribution.id`).
  screen: string
  /// Optional ordering hint; lower sorts earlier. Defaults to insertion order.
  order?: number
}

/// A standalone routed view, selected when the active screen equals `id`.
export interface ScreenContribution extends BaseContribution {
  /// Screen id; the host sets the active screen to this to render the view.
  /// Referenced by a matching `NavItemContribution.screen`.
  render: (props: ScreenRenderProps) => ReactNode
}

/// Props the host passes when rendering a contributed screen. Kept deliberately
/// small; richer state flows through the plugin's own `PluginContext`.
export interface ScreenRenderProps {
  /// A navigation request forwarded from global search, if any (e.g. open a
  /// specific entity on mount). `null` when the screen was opened normally.
  navigationRequest: SearchNavigationTarget | null
  /// Surface a transient message (toast/banner) through the host.
  onMessage: (message: string) => void
}

// --- Settings --------------------------------------------------------------

/// A settings panel contributed into the config screen.
export interface SettingsPanelContribution extends BaseContribution {
  /// Section heading (already localized by the plugin).
  title: string
  render: () => ReactNode
  order?: number
}

// --- Editor ----------------------------------------------------------------

/// A Lexical node class added to the shared editor's node registry. The value is
/// the same `Klass<LexicalNode>` shape entries in
/// `features/editor/nodes/nodeRegistry.ts` already are.
export interface EditorNodeContribution extends BaseContribution {
  /// The registered node's `getType()` name; used for collision detection
  /// against native and other-plugin nodes.
  nodeName: string
  node: Klass<LexicalNode>
}

/// A markdown transformer appended to the shared `EXTENDED_TRANSFORMERS` list.
export interface EditorTransformerContribution extends BaseContribution {
  transformer: Transformer
}

/// A `/`-triggered slash-command entry inside the editor.
export interface SlashCommandContribution extends BaseContribution {
  /// Menu label (already localized).
  label: string
  /// Words the typeahead matches against, beyond `label`.
  keywords?: string[]
  icon?: ComponentType<{ size?: number | string }>
  /// Runs against the editor when chosen; receives the active LexicalEditor.
  run: (editor: import('lexical').LexicalEditor) => void
}

/// A button/control added to the editor toolbar. `slot` is used for collision
/// detection (one contribution per slot).
export interface ToolbarItemContribution extends BaseContribution {
  /// Logical toolbar slot id; duplicates across plugins are a conflict.
  slot: string
  label: string
  icon?: ComponentType<{ size?: number | string }>
  run: (editor: import('lexical').LexicalEditor) => void
  order?: number
}

// --- Global search ---------------------------------------------------------

/// A global-search results provider. Reuses the host's `GlobalSearchEntry` so
/// contributed results merge into the same index the builtin loop builds.
export interface SearchProviderContribution extends BaseContribution {
  /// Produce search entries for the current workspace snapshot. The host passes a
  /// `SearchProviderContext` (`{ workspace, t }`) so the provider indexes the live
  /// workspace directly, independent of whether its screen has ever mounted.
  entries: (ctx: SearchProviderContext) => GlobalSearchEntry[]
  /// Extra scope aliases, e.g. `{ note: ['plugin'], notes: ['plugin'] }`, merged
  /// into the host `SCOPE_ALIASES` map.
  scopeAliases?: Record<string, GlobalSearchKind[]>
  /// Colors keyed by kind, merged into the host `SCOPE_KIND_COLORS` map.
  colors?: Partial<Record<GlobalSearchKind, string>>
}

// --- Card decorations ------------------------------------------------------

/// The host card kinds a badge/action can attach to.
export type CardKind = 'project' | 'task'

/// A small badge rendered on a project/task card.
export interface CardBadgeContribution extends BaseContribution {
  cardKind: CardKind
  /// Render a badge for a given card id; return `null` to render nothing.
  render: (cardId: string) => ReactNode
}

/// An action item rendered on a project/task card's action menu.
export interface CardActionContribution extends BaseContribution {
  cardKind: CardKind
  label: string
  icon?: ComponentType<{ size?: number | string }>
  run: (cardId: string) => void
  order?: number
}

// --- Archive ---------------------------------------------------------------

/// Integration with the host archive: how this plugin's entity type appears in,
/// and is restored from, the archive list.
export interface ArchiveIntegrationContribution extends BaseContribution {
  /// The `ArchivedItem.entidade` value this plugin owns (e.g. a note entity).
  entityType: string
  /// Localized label for the entity type, used in the archive UI.
  entityLabel: string
  /// Restore an archived entity by its archive entry id.
  restore?: (archiveId: string) => Promise<void> | void
}

// --- Commands & shortcuts --------------------------------------------------

/// A command-palette command.
export interface CommandContribution extends BaseContribution {
  /// Palette label (already localized).
  title: string
  description?: string
  run: () => void
}

/// A keyboard shortcut. Registered through the host `ShortcutManager` (the
/// single global keydown owner); `keys` is an accelerator like `mod+shift+n`.
export interface ShortcutContribution extends BaseContribution {
  /// Accelerator string. Collisions with native (`mod+k`, `mod+n`) or other
  /// plugins are surfaced by the conflict detector.
  keys: string
  /// Localized description shown in any shortcut listing.
  description?: string
  run: (event: KeyboardEvent) => void
}

// --- Background jobs -------------------------------------------------------

/// A periodic background job the host scheduler runs while the plugin is active.
export interface BackgroundJobContribution extends BaseContribution {
  /// Interval between runs, in milliseconds.
  intervalMs: number
  /// Whether to run once immediately on activation. Defaults to `false`.
  runOnStart?: boolean
  run: () => Promise<void> | void
}

// --- i18n ------------------------------------------------------------------

/// Locale dictionaries a plugin contributes, merged into the host dictionaries
/// per `Locale`. Keys are namespaced by the plugin to avoid collisions.
export interface I18nContribution extends BaseContribution {
  /// One dictionary per supported `Locale`.
  dictionaries: Partial<Record<Locale, Dictionary>>
}

/// A discriminated catalogue of every contribution type, handy for generic
/// registry plumbing and for the conflict detector to iterate uniformly.
export interface ContributionMap {
  navItem: NavItemContribution
  screen: ScreenContribution
  settingsPanel: SettingsPanelContribution
  editorNode: EditorNodeContribution
  editorTransformer: EditorTransformerContribution
  slashCommand: SlashCommandContribution
  toolbarItem: ToolbarItemContribution
  searchProvider: SearchProviderContribution
  cardBadge: CardBadgeContribution
  cardAction: CardActionContribution
  archiveIntegration: ArchiveIntegrationContribution
  command: CommandContribution
  shortcut: ShortcutContribution
  backgroundJob: BackgroundJobContribution
  i18n: I18nContribution
}

/// The union of every contribution kind.
export type ExtensionPointKind = keyof ContributionMap

/// Any contribution, regardless of kind.
export type AnyContribution = ContributionMap[ExtensionPointKind]
