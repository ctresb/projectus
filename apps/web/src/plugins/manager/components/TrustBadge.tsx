// Presentational trust badge for a plugin's backend integrity/signature verdict.
//
// The backend is the verification authority (SHA-256 + Ed25519); this component
// never decides trust — it consumes the already-resolved `TrustBadge` descriptor
// from `signing/integrity.ts` and renders its localized label with a tone class.
// Core stays plugin-agnostic: this names no plugin.
//
// Tone mapping is the only visual decision here, and it is intentionally calm
// for first-party provenance: a `builtin` plugin (bundled with PROJECTUS)
// resolves to the `positive` tone — the same reassuring styling as `verified` —
// and must never inherit the neutral/alarming look reserved for unknown
// external packages (`unsigned`) or a failed integrity check (`mismatch`).

import { trustBadge, type TrustStatus, type TrustTone } from '../../signing/integrity'
import type { TFn } from '../../../i18n'
import { cx } from '../../../lib/classnames'

/// Maps a semantic trust tone onto the host's existing badge tone classes so the
/// badge follows the active theme instead of hard-coding colours. A `Record`
/// (not a partial) so adding a future `TrustTone` is a compile error until a
/// class is supplied.
const TONE_CLASS: Record<TrustTone, string> = {
  positive: 'badge--positive',
  caution: 'badge--caution',
  neutral: 'badge--neutral',
  danger: 'badge--danger',
}

export function TrustBadge({
  status,
  t,
  className,
}: {
  /// Raw backend verdict; unknown strings fail closed to the fatal `mismatch`.
  status: TrustStatus | string
  t: TFn
  className?: string
}) {
  // Resolve the display descriptor (tone, label key, blocking) from the
  // canonical map. `builtin` arrives here as a `positive`, non-blocking badge.
  const badge = trustBadge(status)
  const label = t(badge.labelKey)
  return (
    <span
      className={cx('badge', 'trust-badge', TONE_CLASS[badge.tone], className)}
      // Styling/test hooks: the normalized verdict and whether it blocks
      // enabling, so CSS can distinguish e.g. a calm `builtin` from a fatal
      // `mismatch` without re-deriving the verdict.
      data-trust={badge.status}
      data-blocking={badge.blocking}
      title={label}
    >
      {label}
    </span>
  )
}
