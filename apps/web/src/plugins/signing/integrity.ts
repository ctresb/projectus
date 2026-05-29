// Frontend-side integrity hashing + trust presentation for plugin packages.
//
// The backend is the verification authority: it recomputes SHA-256 over the
// package bytes, checks the optional Ed25519 signature, and persists the
// resulting verdict as `InstalledPlugin.trust` (see
// `crates/server/src/plugins/signing.rs`). This module never decides trust —
// it only mirrors that verdict for display, and offers a WebCrypto SHA-256
// helper for the rare case the UI wants to hash bytes locally (e.g. previewing
// the digest of a file the user is about to upload). SHA-256 is the only
// algorithm used here; MD5 is never accepted anywhere in the system.

/// The trust verdict the backend assigns a package, mirroring the Rust
/// `TrustStatus` enum (`#[serde(rename_all = "kebab-case")]`). These are the
/// exact strings that arrive over `/api/plugins` and `/api/plugins/{id}/verify`.
export type TrustStatus =
  | 'verified'
  | 'signed-untrusted'
  | 'unsigned'
  | 'mismatch'
  | 'builtin'

/// The closed set of trust verdicts as a runtime-checkable array, kept in sync
/// with `TrustStatus`.
export const ALL_TRUST_STATUSES = [
  'verified',
  'signed-untrusted',
  'unsigned',
  'mismatch',
  'builtin',
] as const satisfies readonly TrustStatus[]

/// Narrowing guard for a raw backend string.
export function isTrustStatus(value: string): value is TrustStatus {
  return (ALL_TRUST_STATUSES as readonly string[]).includes(value)
}

/// Visual tone for a trust badge. Maps onto the host's existing semantic colour
/// roles rather than hard-coded colours, so badges follow the active theme.
export type TrustTone = 'positive' | 'caution' | 'neutral' | 'danger'

/// Presentation descriptor for a trust badge. `labelKey` is an i18n dictionary
/// key (the caller resolves it with `useT`) so the badge text is localizable;
/// `tone` drives styling. Nothing here is authoritative — it is purely how a
/// already-decided verdict is shown.
export interface TrustBadge {
  status: TrustStatus
  tone: TrustTone
  /// Dot-path i18n key, resolvable via the host `TFn`.
  labelKey: string
  /// Whether this verdict should block enabling the plugin in the UI. Only the
  /// fatal `mismatch` verdict is blocking; the backend enforces the same rule.
  blocking: boolean
}

/// Static badge descriptors per verdict. A `Record` (not a partial) so adding a
/// future `TrustStatus` member is a compile error until a badge is supplied.
const TRUST_BADGES: Record<TrustStatus, TrustBadge> = {
  verified: {
    status: 'verified',
    tone: 'positive',
    labelKey: 'plugins.trust.verified',
    blocking: false,
  },
  'signed-untrusted': {
    status: 'signed-untrusted',
    tone: 'caution',
    labelKey: 'plugins.trust.signed_untrusted',
    blocking: false,
  },
  unsigned: {
    status: 'unsigned',
    tone: 'neutral',
    labelKey: 'plugins.trust.unsigned',
    blocking: false,
  },
  mismatch: {
    status: 'mismatch',
    tone: 'danger',
    labelKey: 'plugins.trust.mismatch',
    blocking: true,
  },
  // First-party plugin bundled with PROJECTUS. Not a verification verdict over
  // external bytes but a provenance fact: it ships inside the app, so it is
  // shown with a calm, reassuring badge — never the alarming `unsigned`/
  // `mismatch` styling reserved for unknown external packages.
  builtin: {
    status: 'builtin',
    tone: 'positive',
    labelKey: 'plugins.trust.builtin',
    blocking: false,
  },
}

/// Resolve the display badge for a backend trust verdict. Unknown/garbled
/// strings (a forward-compatibility hedge) fall back to the fatal `mismatch`
/// badge — fail closed, never silently treat an unrecognised verdict as safe.
export function trustBadge(status: TrustStatus | string): TrustBadge {
  return isTrustStatus(status) ? TRUST_BADGES[status] : TRUST_BADGES.mismatch
}

/// Whether a verdict permits the plugin to run. Mirrors the backend rule that
/// refuses to enable a `mismatch` plugin; convenience for gating UI controls.
export function isTrusted(status: TrustStatus | string): boolean {
  return isTrustStatus(status) && status !== 'mismatch'
}

/// Lowercase hex SHA-256 of `bytes`, computed with WebCrypto. The frontend
/// mirror of the backend `sha256_hex` helper — same algorithm, same lowercase
/// hex encoding, so a digest computed here is directly comparable to one the
/// backend pins in a manifest's integrity block. Never MD5.
export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

/// SHA-256 of a UTF-8 string, returned as lowercase hex. Convenience wrapper
/// over {@link sha256Hex} for hashing manifest/text content.
export async function sha256HexOfText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text))
}

/// Case-insensitive comparison of two hex digests (trimming surrounding
/// whitespace), matching the backend's `eq_ignore_ascii_case` integrity check.
/// Both operands must be non-empty to count as a match.
export function digestsMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  return left.length > 0 && left === right
}

/// Encode bytes as lowercase hex, mirroring Rust's `hex::encode`.
function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}
