// Typed client over a plugin's namespaced, revisioned data store
// (`/api/plugins/{id}/data/{collection}`). The backend
// (`crates/server/src/plugins/storage.rs`) is the *sole* durable writer: every
// collection is a revisioned envelope so writers follow the same
// optimistic-concurrency discipline as the rest of PROJECTUS — read a revision,
// write back the revision you saw, get a conflict (HTTP error) if someone moved
// underneath you.
//
// This client is the only place the frontend talks to that wire contract. It is
// scoped to a single plugin id at construction time, so a plugin's runtime
// context can hand each plugin a client locked to its own sandbox and nothing
// here can address another plugin's data. It builds on the shared
// `apiRequest`/`apiBase` host primitives from `lib/api.ts` — no new deps, no
// bespoke fetch wrapper. Field names mirror the backend envelope (`revision`,
// `items`); the surrounding marketplace contract stays English.

import { apiRequest } from '../../lib/api'

/// One plugin data collection as it travels over the wire: an opaque,
/// caller-typed `items` payload wrapped in a monotonically increasing
/// `revision`. Mirrors the backend `PluginData` struct. A never-written
/// collection reads back as the empty default (`revision: 0`, `items: null`),
/// so a fresh plugin can read-before-write without special-casing.
export interface PluginData<T = unknown> {
  revision: number
  items: T
}

/// The lowercase-slug constraint the backend enforces on every id and
/// collection name before it touches the filesystem (`a-z`, `0-9`, `-`). We
/// re-validate client-side so a bad name fails fast and locally with a clear
/// message instead of round-tripping to a 4xx.
const SLUG_PATTERN = /^[a-z0-9-]+$/

function assertSlug(label: string, value: string): void {
  if (!SLUG_PATTERN.test(value)) {
    throw new Error(`${label} de plugin inválido (use apenas a-z, 0-9, '-'): "${value}"`)
  }
}

/// A read/write client for one plugin's data sandbox. Construct it with the
/// plugin id; every method addresses a named collection inside that id's
/// `plugins/<id>/data/` namespace. The id is validated once at construction so
/// the client can never be pointed at a malformed (or traversal-y) path.
export class PluginStorageClient {
  private readonly id: string

  constructor(pluginId: string) {
    assertSlug('id', pluginId)
    this.id = pluginId
  }

  /// Read a collection. A missing plugin/collection is *not* an error: the
  /// backend yields the empty default envelope (`revision: 0`, `items: null`),
  /// letting a brand-new plugin read-before-write. Pass the expected shape as
  /// `T` to type the returned `items`.
  read<T = unknown>(collection: string): Promise<PluginData<T>> {
    assertSlug('coleção', collection)
    return apiRequest<PluginData<T>>(`/plugins/${this.id}/data/${collection}`)
  }

  /// Write a collection under optimistic concurrency. `revision` must equal the
  /// revision you last read (0 for a brand-new collection); a stale revision is
  /// rejected by the backend with a conflict (surfaced as an `ApiFailure`)
  /// without clobbering the stored value. On success the stored revision is
  /// bumped by one and the new envelope returned.
  write<T = unknown>(collection: string, revision: number, items: T): Promise<PluginData<T>> {
    assertSlug('coleção', collection)
    return apiRequest<PluginData<T>>(`/plugins/${this.id}/data/${collection}`, {
      method: 'PUT',
      body: JSON.stringify({ revision, items }),
    })
  }

  /// Read-modify-write convenience that retries past a single concurrent writer:
  /// read the current envelope, apply `update` to its items, and write back with
  /// the revision just read. On a conflict it re-reads and retries up to
  /// `attempts` times before giving up (the final `ApiFailure` propagates). Use
  /// for last-write-wins-but-don't-lose-data mutations; for strict
  /// read-your-write flows call `read`/`write` directly and surface the conflict.
  async update<T = unknown>(
    collection: string,
    update: (current: T) => T,
    attempts = 3,
  ): Promise<PluginData<T>> {
    assertSlug('coleção', collection)
    let lastError: unknown
    for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
      const current = await this.read<T>(collection)
      try {
        return await this.write<T>(collection, current.revision, update(current.items))
      } catch (error) {
        // A revision conflict means someone wrote between our read and write:
        // re-read and retry. Anything else is a real failure — rethrow now.
        if (!isConflict(error)) {
          throw error
        }
        lastError = error
      }
    }
    throw lastError
  }
}

/// True when an error is a revision conflict from a `write` (the backend maps
/// `StoreError::Conflict` to HTTP 409). Used by `update`'s retry loop; kept
/// duck-typed so a missing/changed `ApiFailure` import can't break the client.
function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  )
}
