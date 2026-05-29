// The frontend client for the `/api/plugins` HTTP surface
// (`crates/server/src/plugins/http.rs`): marketplace/registry listing, the two
// install pipelines (zip upload + url), the enable/disable/uninstall lifecycle,
// the integrity `verify` endpoint, the data-purge op, and the namespaced data
// CRUD. The backend is the sole durable writer and the verification authority;
// this module only speaks the wire contract.
//
// It is built entirely on the shared `apiRequest`/`apiBase` host primitives from
// `lib/api.ts` — no bespoke fetch wrapper, no new deps. Wire field names mirror
// the backend (`mensagem`, `installed_at`, `package_sha256`, …); the marketplace
// contract stays English, while host `mensagem` payloads keep their Portuguese
// key as the rest of PROJECTUS does.
//
// Core stays plugin-agnostic: nothing here names a specific plugin id.
//
// Per-collection data CRUD (`read`/`write`/`update` of a single collection) is
// *not* re-implemented here — it lives in `PluginStorageClient`, the
// revision-aware client a plugin's runtime context hands out scoped to its own
// id. This module exposes only `data(id)` (a factory for that client) plus the
// lifecycle-level `deleteData(id)` purge, matching the spec's split of
// data-collection CRUD vs. plugin-lifecycle ops.

import { apiRequest } from '../../lib/api'
import type { PluginManifest } from '../types/manifest'
import type { PluginState, PluginSource } from '../conflicts/detectConflicts'
import type { TrustStatus } from '../signing/integrity'
import { PluginStorageClient } from '../storage/PluginStorageClient'

// --- Wire types ------------------------------------------------------------

/// One plugin's integrity pin, mirroring the backend `LockEntry`
/// (`registry.rs`). Slim by design: just enough to re-derive a trust verdict.
/// `signature` is `null` for an unsigned package.
export interface LockEntry {
  id: string
  version: string
  package_sha256: string
  manifest_sha256: string
  signature: string | null
  verified: TrustStatus
}

/// One installed plugin's full record, mirroring the backend `InstalledPlugin`
/// (`registry.rs`). The list endpoint flattens this and folds in the matching
/// `lock` pin (see {@link InstalledPlugin}); the install/enable/disable
/// endpoints return this record alone (without `lock`).
export interface InstalledPluginRecord {
  manifest: PluginManifest
  state: PluginState
  source: PluginSource
  /// RFC 3339 timestamp of first install.
  installed_at: string
  trust: TrustStatus
}

/// A row from `GET /api/plugins`: an {@link InstalledPluginRecord} (flattened by
/// the backend's `#[serde(flatten)]`) with its lockfile pin folded in. `lock` is
/// `null` when no pin exists for the row.
export interface InstalledPlugin extends InstalledPluginRecord {
  lock: LockEntry | null
}

/// The shape of `GET /api/plugins`: the full installed list with pins folded in.
export interface PluginListResponse {
  plugins: InstalledPlugin[]
}

/// The shape of `GET /api/plugins/{id}/verify`: the freshly recomputed verdict
/// vs. the one recorded at install, and whether they agree. `matches === false`
/// means the on-disk bytes drifted from the lockfile pin since install.
export interface VerifyResponse {
  id: string
  trust: TrustStatus
  recorded: TrustStatus
  matches: boolean
}

/// A generic host message body (`{ mensagem }`), returned by the uninstall and
/// data-purge endpoints. The key stays Portuguese to mirror the host contract.
export interface ApiMessage {
  mensagem: string
}

/// Options for an install (zip or url). `allowUnsigned` admits an
/// unsigned-but-integrity-valid package — the explicit "I know this isn't
/// signed" confirm the backend's `allow_unsigned` flag gates on. Defaults to
/// `false`; a package that fails integrity or signature is refused regardless.
export interface InstallOptions {
  allowUnsigned?: boolean
}

// --- Client ----------------------------------------------------------------

/// `GET /api/plugins` — the full installed-plugin list, each row carrying its
/// manifest, state/source/trust, and folded-in lockfile pin.
function list(): Promise<PluginListResponse> {
  return apiRequest<PluginListResponse>('/plugins')
}

/// `POST /api/plugins/install` — install from an uploaded `.zip`. The package is
/// sent as multipart form data (the backend treats any binary field as the
/// payload); `allowUnsigned` rides along as the truthy `allow_unsigned` field.
/// Returns the freshly installed record (always `state: 'disabled'` — enabling
/// is a separate, deliberate step).
function install(zip: Blob, options: InstallOptions = {}): Promise<InstalledPluginRecord> {
  const form = new FormData()
  form.append('package', zip)
  if (options.allowUnsigned) {
    form.append('allow_unsigned', 'true')
  }
  return apiRequest<InstalledPluginRecord>('/plugins/install', {
    method: 'POST',
    body: form,
  })
}

/// `POST /api/plugins/install-url` — download + install from a URL. Body
/// `{ url, allow_unsigned }`. Same gate as {@link install}; returns the
/// installed record.
function installUrl(url: string, options: InstallOptions = {}): Promise<InstalledPluginRecord> {
  return apiRequest<InstalledPluginRecord>('/plugins/install-url', {
    method: 'POST',
    body: JSON.stringify({ url, allow_unsigned: options.allowUnsigned ?? false }),
  })
}

/// `POST /api/plugins/{id}/enable` — activate a plugin. The backend refuses
/// activation on a `mismatch` trust verdict (surfaced as an `ApiFailure`).
function enable(id: string): Promise<InstalledPluginRecord> {
  return apiRequest<InstalledPluginRecord>(`/plugins/${id}/enable`, { method: 'POST' })
}

/// `POST /api/plugins/{id}/disable` — deactivate a plugin (always allowed).
function disable(id: string): Promise<InstalledPluginRecord> {
  return apiRequest<InstalledPluginRecord>(`/plugins/${id}/disable`, { method: 'POST' })
}

/// `DELETE /api/plugins/{id}` — uninstall a plugin, *preserving* its data
/// sandbox so a reinstall can recover it. To also wipe the data, follow up with
/// {@link deleteData}. Returns the host's confirmation message.
function uninstall(id: string): Promise<ApiMessage> {
  return apiRequest<ApiMessage>(`/plugins/${id}`, { method: 'DELETE' })
}

/// `DELETE /api/plugins/{id}/data` — purge a plugin's entire data sandbox. A
/// plugin-lifecycle op independent of {@link uninstall}: it leaves the registry
/// record (if any) untouched and removes every collection under the plugin's
/// `data/` namespace. This is the deliberate counterpart to the per-collection
/// CRUD on {@link PluginStorageClient}, which never deletes whole sandboxes.
function deleteData(id: string): Promise<ApiMessage> {
  return apiRequest<ApiMessage>(`/plugins/${id}/data`, { method: 'DELETE' })
}

/// `GET /api/plugins/{id}/verify` — re-derive the integrity verdict from the
/// bytes on disk and compare it to the verdict recorded at install. Lets the UI
/// flag post-install tampering (`matches === false`). The backend remains the
/// verification authority; this only consumes its verdict.
function verify(id: string): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>(`/plugins/${id}/verify`, { method: 'GET' })
}

/// A revision-aware client over plugin `id`'s data sandbox
/// (`/api/plugins/{id}/data/{collection}`) for per-collection read/write/update.
/// Construction validates the id slug; the returned client cannot address any
/// other plugin's data. Whole-sandbox purge is the separate {@link deleteData}.
function data(id: string): PluginStorageClient {
  return new PluginStorageClient(id)
}

/// The `/api/plugins` client surface, mirroring the host `api` object's shape:
/// a single namespaced object of thin endpoint wrappers built on `apiRequest`.
export const pluginApi = {
  list,
  install,
  installUrl,
  enable,
  disable,
  uninstall,
  deleteData,
  verify,
  data,
}
