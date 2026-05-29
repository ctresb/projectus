// The plugin detail body rendered inside a centered `ModalContent`.
//
// It presents everything a user needs to decide whether to trust and enable a
// plugin: a resolved icon + title, a metadata badge row (version, publisher,
// trust verdict, enabled/disabled state), then the grouped review sections
// (description, permissions, interactions, shortcuts, conflicts) inside a
// `SquareScrollArea` so a long review scrolls comfortably instead of cramping a
// side drawer. It ends with the lifecycle actions (Enable/Disable, Uninstall,
// Delete data) pinned below the scroll body.
//
// This component decides *nothing* about trust or conflicts itself: it consumes
// the backend's `trust` verdict (through `<TrustBadge>` / `trustBadge`) and the
// pure detector's `conflicts`, and only *gates the controls* on those verdicts.
// Enable is blocked while any fatal conflict stands (integrity mismatch, a
// disabled permission a contribution needs, an api/declared conflict); an
// unsigned-but-valid package additionally requires the user to tick an explicit
// "I understand this is unsigned" confirm before Enable lights up. Core stays
// plugin-agnostic: no plugin id is named anywhere in this file.

import { useState, type ComponentType, type ReactNode } from 'react'
// A SMALL curated set of icons plugins may name in their manifest `icon` field.
// NEVER `import * as LucideIcons` — that pulls the entire lucide-react icon set
// (hundreds of KB) into the main bundle. Unknown names fall back to `Blocks`.
import {
  Blocks,
  Lightbulb,
  Puzzle,
  Search as SearchIcon,
  Link2,
  Bot,
  Network,
  Cloud,
  FileText,
  GitBranch,
  Database,
  Image as ImageIcon,
} from 'lucide-react'
import { Button, Card, Checkbox, Text } from '../../../components/ui'
import { SquareScrollArea } from '../../../components/SquareScrollArea'
import type { TFn } from '../../../i18n'
import { cx } from '../../../lib/classnames'
import type { InstalledPlugin } from '../../lib/pluginApi'
import type { PermissionId } from '../../types/permissions'
import type { PluginConflict } from '../../conflicts/detectConflicts'
import { trustBadge } from '../../signing/integrity'
import { TrustBadge } from './TrustBadge'
import { PermissionList } from './PermissionList'
import { InteractionList } from './InteractionList'
import { ShortcutList } from './ShortcutList'
import { ConflictList } from './ConflictList'

type IconComponent = ComponentType<{ size?: number | string; 'aria-hidden'?: boolean }>

export function PluginDetails({
  plugin,
  conflicts,
  disabledPermissions,
  busy = false,
  onEnable,
  onDisable,
  onUninstall,
  onDeleteData,
  onTogglePermission,
  t,
}: {
  /// The installed-plugin row to display (manifest + state/source/trust + lock).
  plugin: InstalledPlugin
  /// Conflicts the pure detector reported against this plugin. The detector is
  /// the authority on what blocks activation; this body only renders + gates.
  conflicts: readonly PluginConflict[]
  /// Permissions the user has switched off for this plugin. Defaults to none.
  disabledPermissions?: readonly PermissionId[]
  /// True while a lifecycle action is in flight; disables every control.
  busy?: boolean
  onEnable: () => void
  onDisable: () => void
  onUninstall: () => void
  onDeleteData: () => void
  /// Toggle one declared permission on/off for this plugin. Omit to render the
  /// permission list read-only.
  onTogglePermission?: (permission: PermissionId, enabled: boolean) => void
  t: TFn
}) {
  const { manifest, state, trust } = plugin
  const enabled = state === 'enabled'

  // An unsigned-but-integrity-valid package is allowed to run, but only after an
  // explicit acknowledgement; the checkbox state lives here, not in the manifest.
  const isUnsigned = trust === 'unsigned'
  const [unsignedAck, setUnsignedAck] = useState(false)

  // Trust-side block (the fatal `mismatch` verdict) — the backend enforces the
  // same rule; `trustBadge().blocking` is its single source of truth here.
  const trustBlocks = trustBadge(trust).blocking
  // Conflict-side block — any fatal conflict (integrity mismatch, a disabled
  // permission a contribution needs, api-too-new, declared conflict) bars enable.
  const hasFatalConflict = conflicts.some((conflict) => conflict.severity === 'fatal')
  // Unsigned packages need the explicit confirm before Enable lights up.
  const needsUnsignedAck = isUnsigned && !unsignedAck

  const enableBlocked = trustBlocks || hasFatalConflict || needsUnsignedAck

  return (
    <div className="plugin-details">
      <header className="plugin-details__head">
        <PluginIcon icon={manifest.icon} />
        <div className="plugin-details__heading">
          <Text as="span" className="plugin-details__title">
            {manifest.title}
          </Text>
          <div className="plugin-details__meta">
            <span className="badge badge--neutral plugin-details__meta-badge">
              {t('plugins.details.version', { version: manifest.version })}
            </span>
            {manifest.publisher && (
              <span className="badge badge--neutral plugin-details__meta-badge">
                {t('plugins.details.publisher', { publisher: manifest.publisher })}
              </span>
            )}
            <TrustBadge status={trust} t={t} className="plugin-details__meta-badge" />
            <span
              className={cx(
                'badge plugin-details__meta-badge',
                enabled ? 'badge--positive' : 'badge--neutral',
              )}
            >
              {t(enabled ? 'plugins.details.state.enabled' : 'plugins.details.state.disabled')}
            </span>
          </div>
        </div>
      </header>

      <SquareScrollArea className="plugin-details__scroll" viewportClassName="plugin-details__body">
        {(manifest.short_description || manifest.long_description) && (
          <Section title={t('plugins.details.section.about')}>
            {manifest.short_description && <Text>{manifest.short_description}</Text>}
            {manifest.long_description && (
              <Text tone="muted">{manifest.long_description}</Text>
            )}
          </Section>
        )}

        <Section title={t('plugins.details.section.permissions')}>
          <PermissionList
            permissions={manifest.permissions}
            disabled={disabledPermissions}
            onToggle={onTogglePermission}
            t={t}
          />
        </Section>

        <Section title={t('plugins.details.section.interactions')}>
          <InteractionList interactions={manifest.interacts_with} t={t} />
        </Section>

        <Section title={t('plugins.details.section.shortcuts')}>
          <ShortcutList shortcuts={manifest.shortcuts} t={t} />
        </Section>

        <Section title={t('plugins.details.section.conflicts')}>
          <ConflictList conflicts={conflicts} t={t} />
        </Section>

        {isUnsigned && !enabled && (
          <Card className="plugin-details__unsigned">
            <Checkbox
              checked={unsignedAck}
              disabled={busy}
              onCheckedChange={setUnsignedAck}
              label={
                <span className="plugin-details__unsigned-text">
                  <Text as="span">{t('plugins.details.unsigned_confirm.label')}</Text>
                  <Text as="small" tone="muted">
                    {t('plugins.details.unsigned_confirm.description')}
                  </Text>
                </span>
              }
            />
          </Card>
        )}
      </SquareScrollArea>

      <footer className="plugin-details__actions">
        {enabled ? (
          <Button variant="quiet" disabled={busy} onClick={onDisable}>
            {t('plugins.details.action.disable')}
          </Button>
        ) : (
          <Button variant="primary" disabled={busy || enableBlocked} onClick={onEnable}>
            {t('plugins.details.action.enable')}
          </Button>
        )}
        <Button variant="quiet" disabled={busy} onClick={onUninstall}>
          {t('plugins.details.action.uninstall')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={onDeleteData}>
          {t('plugins.details.action.delete_data')}
        </Button>
      </footer>
    </div>
  )
}

/// The plugin's manifest icon, resolved from its lucide-react name into the real
/// icon component and rendered inside a framed tile. When the manifest names no
/// icon (or names one that does not resolve to a lucide component) it falls back
/// to a generic `Blocks` glyph — never a stray bare letter. The icon name is a
/// display value only; it is never executed.
function PluginIcon({ icon }: { icon: string }) {
  const Glyph = resolveLucideIcon(icon)
  return (
    <span className="plugin-details__icon" aria-hidden="true">
      <Glyph size={22} aria-hidden />
    </span>
  )
}

/// The curated icon set a manifest `icon` name may resolve to. Keyed by the
/// PascalCase lucide name. Intentionally small (and statically imported) so the
/// bundle only carries these glyphs, never the whole library.
const PLUGIN_ICONS: Record<string, IconComponent> = {
  Blocks,
  Lightbulb,
  Puzzle,
  Search: SearchIcon,
  Link2,
  Bot,
  Network,
  Cloud,
  FileText,
  GitBranch,
  Database,
  Image: ImageIcon,
}

/// Resolve a PascalCase lucide-react icon name (the manifest `icon` field) to its
/// component, falling back to the generic `Blocks` glyph for an empty/unknown
/// name. Only names in the curated `PLUGIN_ICONS` map resolve.
function resolveLucideIcon(name: string): IconComponent {
  return (name && PLUGIN_ICONS[name]) || Blocks
}

/// A titled block grouping one part of the detail body.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="plugin-details__section">
      <Text as="span" className="plugin-details__section-title">
        {title}
      </Text>
      {children}
    </section>
  )
}
