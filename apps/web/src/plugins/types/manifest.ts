// TypeScript mirror of the backend plugin manifest
// (`crates/server/src/plugins/manifest.rs`). The backend is the verification
// authority — `validate()` lives in Rust — so this type exists only to give the
// frontend a faithful, strict view of the document it receives over
// `/api/plugins`. Field names stay English here (the plugin contract is the
// marketplace-facing surface, not a PROJECTUS domain entity); the surrounding
// host data keeps its Portuguese identifiers untouched.
//
// `#[serde(default)]` fields on the Rust side are always present in serialized
// output (serde emits the default), so they are required-but-defaulted here
// rather than optional. The one genuinely optional fields are those typed
// `Option<_>` in Rust (`backend_entry`, `signature`).

import type { PermissionId } from './permissions'
import type { InteractionId } from './interactions'

/// Inclusive host-API compatibility window. Defaults to "this build only" on the
/// backend (`min === max === API_VERSION`).
export interface ApiVersionRange {
  min: number
  max: number
}

/// A single declared storage migration step. The host runs these in order when
/// `storage_schema_version` advances.
export interface Migration {
  from: number
  to: number
  description: string
}

/// A keyboard shortcut a plugin requests in its manifest. `keys` is an
/// accelerator string, e.g. `mod+shift+n`.
export interface ManifestShortcut {
  id: string
  keys: string
  description: string
}

/// A command surfaced in the command palette / menus.
export interface ManifestCommand {
  id: string
  title: string
  description: string
}

/// Integrity block. SHA-256 is the mandatory algorithm; MD5 is never accepted.
export interface IntegrityMeta {
  package_sha256: string
  manifest_sha256: string
  /// Always `'sha256'` for an accepted manifest.
  algorithm: string
}

/// Ed25519 signature block. Base64-encoded key + signature; `publisher_identity`
/// is what a trust registry keys on. Absent (`null`) on unsigned packages.
export interface SignatureMeta {
  /// Always `'ed25519'` when present.
  algorithm: string
  public_key: string
  signature: string
  publisher_identity: string
  verified_publisher: boolean
}

/// Marketplace-facing presentation metadata. Non-authoritative; the host's own
/// trust checks (SHA-256 + signature) decide what actually runs.
export interface MarketplaceMeta {
  category: string
  tags: string[]
  verified: boolean
  featured: boolean
  downloads: number
  rating: number
}

/// The full plugin manifest, mirroring the Rust `PluginManifest` struct.
export interface PluginManifest {
  /// Slug identity, e.g. `notes`. Matches `[a-z0-9-]+`.
  id: string
  title: string
  short_description: string
  long_description: string
  /// Semver-ish `MAJOR.MINOR.PATCH`.
  version: string
  author: string
  publisher: string
  homepage: string
  repository: string
  license: string
  icon: string
  screenshots: string[]
  changelog: string
  /// Lowest host API version this plugin tolerates.
  min_api_version: number
  api_version_range: ApiVersionRange
  /// ESM entry the frontend dynamically imports (a URL/path served by the host).
  frontend_entry: string
  /// Optional native/backend entry; `null` for pure-frontend plugins.
  backend_entry: string | null
  storage_schema_version: number
  migrations: Migration[]
  /// Extension-point ids this plugin contributes to. Validated against the
  /// host vocabulary on the backend.
  extension_points: string[]
  /// Declared permissions. Only members of `PermissionId` are accepted.
  permissions: PermissionId[]
  shortcuts: ManifestShortcut[]
  commands: ManifestCommand[]
  /// Host surfaces this plugin cooperates with. Members of `InteractionId`.
  interacts_with: InteractionId[]
  /// Other plugin ids this one cannot coexist with.
  conflicts: string[]
  integrity: IntegrityMeta
  signature: SignatureMeta | null
  marketplace: MarketplaceMeta
}
