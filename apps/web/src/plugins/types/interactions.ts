// The closed vocabulary of host surfaces a plugin may declare it cooperates
// with via the manifest `interacts_with` field.
//
// This keeps cross-plugin / plugin-to-host coupling honest and inspectable: a
// plugin states up front which host capabilities it touches, and the conflict
// detector (`conflicts/detectConflicts.ts`) can reason about overlaps without
// running the plugin. Core stays plugin-agnostic — these are host surfaces, not
// plugin ids.

/// A single host surface a plugin can interact with.
export type InteractionId =
  /// The shared markdown editor (nodes, transformers, slash/toolbar items).
  | 'MARKDOWN_EDITOR'
  /// The left-rail side navigation.
  | 'SIDE_NAVIGATION'
  /// The command-palette / global search.
  | 'GLOBAL_SEARCH'
  /// The settings screen.
  | 'SETTINGS'
  /// Project cards (badges, actions).
  | 'PROJECT_CARDS'
  /// Task cards (badges, actions).
  | 'TASK_CARDS'
  /// The tag system.
  | 'TAGS'
  /// The archive.
  | 'ARCHIVE'
  /// The backup subsystem.
  | 'BACKUP'
  /// The host secret store.
  | 'SECRETS'
  /// Outbound network.
  | 'NETWORK'
  /// The plugin's namespaced file/data storage.
  | 'FILE_STORAGE'
  /// The global shortcut manager.
  | 'SHORTCUTS'
  /// Background jobs / timers.
  | 'BACKGROUND_JOBS'

/// The full closed set as a runtime-checkable array, kept in sync with the
/// `InteractionId` union.
export const ALL_INTERACTIONS = [
  'MARKDOWN_EDITOR',
  'SIDE_NAVIGATION',
  'GLOBAL_SEARCH',
  'SETTINGS',
  'PROJECT_CARDS',
  'TASK_CARDS',
  'TAGS',
  'ARCHIVE',
  'BACKUP',
  'SECRETS',
  'NETWORK',
  'FILE_STORAGE',
  'SHORTCUTS',
  'BACKGROUND_JOBS',
] as const satisfies readonly InteractionId[]

/// Narrowing guard: is `value` an interaction surface the host understands?
export function isInteractionId(value: string): value is InteractionId {
  return (ALL_INTERACTIONS as readonly string[]).includes(value)
}
