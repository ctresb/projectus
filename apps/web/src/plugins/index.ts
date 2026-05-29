// Public surface of the plugin subsystem.
//
// The rest of the app (Shell, App, the editor, global search, settings, archive)
// reaches the plugin system *only* through this barrel: it mounts `<PluginHost>`,
// reads the live registry via `useRegistry` / `usePluginHost`, and consumes the
// typed contribution shapes. Internal modules (loader, sandbox, conflict passes,
// scoped context) are intentionally not re-exported here — they are runtime
// plumbing the host owns, not app-facing API. Keeping the public surface small
// is what keeps core plugin-agnostic: the app never imports a builtin or a
// concrete loader, only this contract.

// --- Host provider + lifecycle ---------------------------------------------

export {
  PluginHost,
  usePluginHost,
  type PluginHostProps,
  type PluginHostNative,
  type PluginHostValue,
  type PluginHostStatus,
} from './runtime/PluginHost'

// --- Live registry (React binding + shared instance + snapshot shape) -------

export { useRegistry } from './registry/useRegistry'
export { pluginRegistry, PluginRegistry, type RegistrySnapshot } from './registry/PluginRegistry'

// --- Contribution / extension-point types -----------------------------------

export type {
  BaseContribution,
  NavItemContribution,
  ScreenContribution,
  ScreenRenderProps,
  SettingsPanelContribution,
  EditorNodeContribution,
  EditorTransformerContribution,
  SlashCommandContribution,
  ToolbarItemContribution,
  SearchProviderContribution,
  CardKind,
  CardBadgeContribution,
  CardActionContribution,
  ArchiveIntegrationContribution,
  CommandContribution,
  ShortcutContribution,
  BackgroundJobContribution,
  I18nContribution,
  ContributionMap,
  ExtensionPointKind,
  AnyContribution,
} from './types/extension-points'

// --- Manifest / permission / interaction types ------------------------------

export type { PluginManifest } from './types/manifest'
export {
  type PermissionId,
  ALL_PERMISSIONS,
  isPermissionId,
} from './types/permissions'
export {
  type InteractionId,
  ALL_INTERACTIONS,
  isInteractionId,
} from './types/interactions'

// --- Conflict report (consumed by the settings UI) --------------------------

export {
  detectConflicts,
  NATIVE_OWNER,
  type PluginConflict,
  type PluginConflictKind,
  type PluginConflictSeverity,
  type TrustStatus,
  type PluginState,
  type PluginSource,
  type NativeBaseline,
  type DisabledPermissions,
} from './conflicts/detectConflicts'

// --- Trust / integrity display helpers --------------------------------------

export {
  trustBadge,
  isTrusted,
  isTrustStatus,
  ALL_TRUST_STATUSES,
  type TrustTone,
  type TrustBadge,
} from './signing/integrity'

// --- Backend client (install / lifecycle / verify / data) -------------------

export {
  pluginApi,
  type InstalledPlugin,
  type InstalledPluginRecord,
  type PluginListResponse,
  type VerifyResponse,
  type InstallOptions,
} from './lib/pluginApi'
