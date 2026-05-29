// The permission gate every plugin capability passes through.
//
// A plugin declares the permissions it needs in its manifest (`permissions[]`,
// a closed `PermissionId` set). Before the runtime hands a plugin any host
// capability — registering a screen, a shortcut, an editor node, talking to the
// network, opening its data store — it checks that capability's gating
// permission against the manifest here. `runtime/PluginContext.ts` wraps every
// registrar/method in `assertPermission`, so an undeclared capability fails
// loudly at activation instead of silently doing privileged work.
//
// The backend manifest validator is the authority on *which* permissions a
// plugin may declare; this module only enforces that the plugin actually
// declared the one it is now trying to use. It names no plugin id and pulls in
// no new deps — it reads the manifest's declared set and nothing else.

import type { PluginManifest } from '../types/manifest'
import type { PermissionId } from '../types/permissions'

/// Thrown when a plugin attempts a capability whose gating permission it did not
/// declare. Carries the offending plugin id + permission so the host can surface
/// a precise message and the conflict UI can correlate it with a
/// `permission-disabled` / runtime denial.
export class PermissionDeniedError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly permission: PermissionId,
  ) {
    super(
      `Plugin "${pluginId}" não declarou a permissão "${permission}" necessária para esta capacidade.`,
    )
    this.name = 'PermissionDeniedError'
  }
}

/// Does the manifest declare `permission`? Pure predicate over the manifest's
/// closed declared set — no I/O, no throwing. Use it for permission-aware UI
/// (e.g. hiding a control) where a missing permission is expected, not an error.
export function hasPermission(manifest: PluginManifest, permission: PermissionId): boolean {
  return manifest.permissions.includes(permission)
}

/// Enforce that `manifest` declared `permission`; throw `PermissionDeniedError`
/// otherwise. This is the throwing gate the runtime `PluginContext` wraps every
/// capability with, so an undeclared capability cannot run. A no-op when the
/// permission is present.
export function assertPermission(manifest: PluginManifest, permission: PermissionId): void {
  if (!hasPermission(manifest, permission)) {
    throw new PermissionDeniedError(manifest.id, permission)
  }
}
