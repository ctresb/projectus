// Presentational list of the conflicts the detector reported against a plugin.
//
// `detectConflicts` (pure, in `conflicts/detectConflicts.ts`) is the authority on
// what blocks activation; this component only renders its verdicts. Rows are
// grouped by severity (fatal → warning → info) so the user reads the blocking
// problems first and the merely-advisory notes last. Each row shows the
// conflict's severity tone, a localized kind label as its bold title, and the
// detector's pre-built `message` as a muted description (it already embeds the
// plugin/other ids and the colliding `detail`).
//
// The informational `reserved-delegated` kind (a plugin declaring one of
// PROJECTUS's own reserved accelerators) is rendered as a calm note — its
// delegated accelerator is shown as a keycap, never as a scary "duplicate".

import { Card, Text } from '../../../components/ui'
import type { PluginConflict, PluginConflictSeverity } from '../../conflicts/detectConflicts'
import type { TFn } from '../../../i18n'
import { cx } from '../../../lib/classnames'

/// Maps detector severity onto the host's badge tone classes. `info` is the
/// advisory tone used by `reserved-delegated` (the host owns the accelerator and
/// delegates it) — neutral, never alarming.
const SEVERITY_CLASS: Record<PluginConflictSeverity, string> = {
  fatal: 'badge--danger',
  warning: 'badge--caution',
  info: 'badge--neutral',
}

/// Render order for the severity groups: blocking problems first, advisory notes
/// last. Drives both the grouping and the heading order. A full
/// `Record<PluginConflictSeverity, ...>` keeps this exhaustive — adding a
/// severity to the union forces it to be ordered here.
const SEVERITY_ORDER: Record<PluginConflictSeverity, number> = {
  fatal: 0,
  warning: 1,
  info: 2,
}

export function ConflictList({
  conflicts,
  t,
}: {
  /// The conflicts the detector reported for this plugin, in detection order.
  conflicts: readonly PluginConflict[]
  t: TFn
}) {
  if (conflicts.length === 0) {
    return (
      <Text tone="subtle" as="small" className="plugin-conflict-list__empty">
        {t('plugins.conflicts.none')}
      </Text>
    )
  }

  // Group by severity, preserving detection order within each group, then order
  // the groups fatal → warning → info.
  const groups = new Map<PluginConflictSeverity, PluginConflict[]>()
  for (const conflict of conflicts) {
    const bucket = groups.get(conflict.severity)
    if (bucket) bucket.push(conflict)
    else groups.set(conflict.severity, [conflict])
  }
  const orderedGroups = [...groups.entries()].sort(
    ([a], [b]) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b],
  )

  return (
    <div className="plugin-conflict-list">
      {orderedGroups.map(([severity, rows]) => (
        <div
          key={severity}
          className={cx('plugin-conflict-group', `plugin-conflict-group--${severity}`)}
        >
          <Text as="small" tone="subtle" className="plugin-conflict-group__heading">
            {t(`plugins.conflict.severity.${severity}`)}
          </Text>
          <ul className="plugin-conflict-group__items">
            {rows.map((conflict, index) => (
              <li
                key={`${conflict.kind}:${conflict.pluginId}:${conflict.otherId ?? ''}:${index}`}
              >
                <Card
                  className={cx('plugin-conflict', `plugin-conflict--${conflict.severity}`)}
                >
                  <header className="plugin-conflict__head">
                    <span className={cx('badge', SEVERITY_CLASS[conflict.severity])}>
                      {t(`plugins.conflict.severity.${conflict.severity}`)}
                    </span>
                    <Text as="span" className="plugin-conflict__kind">
                      {t(`plugins.conflict.kind.${conflict.kind}`)}
                    </Text>
                    {conflict.reservedKey && (
                      <kbd className="plugin-conflict__key">{conflict.reservedKey}</kbd>
                    )}
                  </header>
                  <Text as="small" tone="muted" className="plugin-conflict__message">
                    {conflict.message}
                  </Text>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
