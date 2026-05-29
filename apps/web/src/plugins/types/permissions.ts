// The closed permission vocabulary the host knows how to grant.
//
// A manifest may only declare members of this set; the host's permission gate
// (`permissions/checkPermission.ts`) and the backend manifest validator both
// refuse anything outside it. Capability-style ids are kebab/colon-cased to
// mirror the marketplace contract and the Rust `Permission` enum.
//
// Core stays plugin-agnostic: nothing here names a specific plugin. The
// `notes:read` / `notes:write` pair is a host-entity scope (the Notes feature is
// a builtin domain), not a hard dependency on any one plugin id.

/// A single permission a plugin may declare in its manifest.
export type PermissionId =
  // --- Host entity scopes -------------------------------------------------
  /// Read host Notes entities through the exposed notes API.
  | 'notes:read'
  /// Create/update host Notes entities.
  | 'notes:write'
  /// Read host project entities.
  | 'projects:read'
  /// Read host task entities.
  | 'tasks:read'
  // --- UI surface contributions ------------------------------------------
  /// Contribute a routed screen + side-navigation entry.
  | 'screens:add'
  /// Contribute a settings panel.
  | 'settings:add'
  /// Register keyboard shortcuts through the host shortcut manager.
  | 'shortcuts:register'
  /// Register command-palette commands.
  | 'commands:register'
  /// Contribute a global-search results provider.
  | 'search:provide'
  /// Contribute editor nodes / transformers / slash + toolbar items.
  | 'editor:extend'
  // --- Host integrations --------------------------------------------------
  /// Create entries in the host archive.
  | 'archive:create'
  /// Receive uploaded attachments / contribute an attachment endpoint.
  | 'attachments'
  /// Subscribe to the host live-event stream.
  | 'events'
  // --- Platform capabilities ---------------------------------------------
  /// Make outbound network requests.
  | 'network'
  /// Read/write the plugin's own namespaced data store.
  | 'file:storage'
  /// Store/read encrypted secrets in the host secret store.
  | 'secrets'
  /// Schedule background jobs / timers.
  | 'background-jobs'

/// The full closed set as a runtime-checkable array. Kept in sync with the
/// `PermissionId` union; useful for validating manifest strings and for tests.
export const ALL_PERMISSIONS = [
  'notes:read',
  'notes:write',
  'projects:read',
  'tasks:read',
  'screens:add',
  'settings:add',
  'shortcuts:register',
  'commands:register',
  'search:provide',
  'editor:extend',
  'archive:create',
  'attachments',
  'events',
  'network',
  'file:storage',
  'secrets',
  'background-jobs',
] as const satisfies readonly PermissionId[]

/// Narrowing guard: is `value` a permission the host understands?
export function isPermissionId(value: string): value is PermissionId {
  return (ALL_PERMISSIONS as readonly string[]).includes(value)
}
