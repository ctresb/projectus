// The plugin manager screen: the native "plugins" route App.tsx renders.
//
// It is the single surface where a user reviews, installs, enables, disables and
// removes plugins. It reads the *authoritative* runtime state from the host
// (`usePluginHost`): the installed rows, the conflict report the host already
// computed with `detectConflicts`, and the no-restart `enable`/`disable`/`refresh`
// lifecycle. It never re-fetches or re-detects on its own — the host is the
// single source of truth, this view only presents it and drives its actions.
//
// Layout is a normal PROJECTUS screen, mirroring Settings/Archive: a `Container`
// + `PageHeader` (eyebrow EXTENSOES / title) whose body scrolls as a unit inside
// one `SquareScrollArea`. The body is two `Section`s — the installed plugins
// (each a `Card` row: icon, title, version/publisher byline, a trust badge, an
// enabled toggle) and the `InstallPanel`. Selecting a card opens the full
// `PluginDetails` review inside a centered `Modal` (its body in its own
// `SquareScrollArea`), where the deliberate Enable/Disable/Uninstall/Delete-data
// actions live (Enable gated on trust + conflicts + the unsigned acknowledgement,
// as `PluginDetails` enforces).
//
// Per-plugin user-disabled permissions are held here as view state and threaded
// into `PluginDetails` so its permission toggles read/write a consistent value;
// the host owns activation, so toggling re-renders the detail gate locally while
// the backend remains the durable writer. Conflicts shown for a plugin are the
// host's report filtered to that plugin id — no second detector is run.
//
// Core stays plugin-agnostic: nothing here names a specific plugin id.

import { useMemo, useState } from 'react'
import { Blocks } from 'lucide-react'
import {
  Button,
  Card,
  Checkbox,
  Container,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Section,
  Text,
} from '../../components/ui'
import { ModalContainer, ModalContent } from '../../components/ui'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { useT, type TFn } from '../../i18n'
import { cx } from '../../lib/classnames'
import { ApiFailure } from '../../lib/api'
import { usePluginHost } from '../runtime/PluginHost'
import { pluginApi, type InstalledPlugin, type InstalledPluginRecord } from '../lib/pluginApi'
import type { PluginConflict } from '../conflicts/detectConflicts'
import type { PermissionId } from '../types/permissions'
import { trustBadge } from '../signing/integrity'
import { TrustBadge } from './components/TrustBadge'
import { PluginDetails } from './components/PluginDetails'
import { InstallPanel } from './components/InstallPanel'

/// Per-plugin set of permissions the user has switched off, keyed by plugin id.
/// Local view state only — it tightens the detail gate in place; the host owns
/// activation and the backend owns durability.
type DisabledByPlugin = Readonly<Record<string, readonly PermissionId[]>>

export function PluginManagerView({
  onMessage,
}: {
  /// Surface a localized status/error toast through the host's message channel,
  /// matching the other native screens' `(type, text)` contract.
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const host = usePluginHost()
  const { plugins, conflicts, status, error } = host

  // The plugin whose detail modal is open, by id. The row itself is looked up
  // from the live `plugins` list so it always reflects the latest state/trust.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // True while a lifecycle action (enable/disable/uninstall/delete) is in flight,
  // so every control in the view and the open modal is disabled together.
  const [busy, setBusy] = useState(false)
  // User-disabled permissions per plugin (drives the detail permission toggles).
  const [disabledPermissions, setDisabledPermissions] = useState<DisabledByPlugin>({})

  const selected = useMemo(
    () => plugins.find((plugin) => plugin.manifest.id === selectedId) ?? null,
    [plugins, selectedId],
  )

  // Conflicts the host already detected, bucketed by the plugin they are reported
  // against. Built once per report so each card/detail reads its slice in O(1).
  const conflictsByPlugin = useMemo(() => {
    const map = new Map<string, PluginConflict[]>()
    for (const conflict of conflicts) {
      const bucket = map.get(conflict.pluginId)
      if (bucket) bucket.push(conflict)
      else map.set(conflict.pluginId, [conflict])
    }
    return map
  }, [conflicts])

  const conflictsFor = (id: string): readonly PluginConflict[] => conflictsByPlugin.get(id) ?? []

  // Run one lifecycle action, funnelling success (a localized ok toast) and
  // failure (the backend's message, or a generic fallback) through one place and
  // keeping the whole view disabled while it is in flight.
  const runAction = async (action: () => Promise<void>, okKey: string) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      onMessage('ok', t(okKey))
    } catch (cause) {
      onMessage('erro', cause instanceof ApiFailure ? cause.message : t('plugins.manager.action_failed'))
    } finally {
      setBusy(false)
    }
  }

  const enablePlugin = (id: string) =>
    runAction(() => host.enable(id), 'plugins.manager.enabled')

  const disablePlugin = (id: string) =>
    runAction(() => host.disable(id), 'plugins.manager.disabled')

  const uninstallPlugin = (id: string) =>
    runAction(async () => {
      await pluginApi.uninstall(id)
      await host.refresh()
      setSelectedId((current) => (current === id ? null : current))
    }, 'plugins.manager.uninstalled')

  const deletePluginData = (id: string) =>
    runAction(async () => {
      await pluginApi.deleteData(id)
      await host.refresh()
    }, 'plugins.manager.data_deleted')

  // Toggle one declared permission off/on for a plugin. Switching a permission
  // off tightens the detail gate immediately (the host's report already flags any
  // contribution that needs it once the host is re-run); switching it back on
  // clears it from the disabled set.
  const togglePermission = (id: string, permission: PermissionId, allow: boolean) => {
    setDisabledPermissions((current) => {
      const off = new Set(current[id] ?? [])
      if (allow) off.delete(permission)
      else off.add(permission)
      return { ...current, [id]: [...off] }
    })
  }

  // After an install the backend always returns a `disabled` record; refresh the
  // host so the new row (with its lock pin) lands in the list, then open its
  // pre-activation review so the user can inspect before enabling.
  const onInstalled = (record: InstalledPluginRecord) => {
    void host.refresh().finally(() => setSelectedId(record.manifest.id))
  }

  const loading = status === 'loading' && plugins.length === 0

  return (
    <Container className="plugin-manager">
      <PageHeader eyebrow={t('plugins.manager.eyebrow')} title={t('plugins.manager.title')} />

      <SquareScrollArea className="plugin-manager__scroll" viewportClassName="plugin-manager__viewport">
        <div className="plugin-manager__body">
          <Section className="plugin-manager__section" aria-label={t('plugins.manager.section.installed')}>
            <div className="plugin-manager__section-head">
              <Text as="span" className="plugin-manager__section-title">
                {t('plugins.manager.section.installed')}
              </Text>
              <Text as="small" tone="muted" className="plugin-manager__section-hint">
                {t('plugins.manager.section.installed_hint')}
              </Text>
            </div>

            <div className="plugin-manager__list">
              {loading ? (
                <LoadingState>{t('plugins.manager.loading')}</LoadingState>
              ) : status === 'error' ? (
                <ErrorState>{error ?? t('plugins.manager.load_failed')}</ErrorState>
              ) : plugins.length === 0 ? (
                <EmptyState>{t('plugins.manager.empty')}</EmptyState>
              ) : (
                plugins.map((plugin) => (
                  <PluginCard
                    key={plugin.manifest.id}
                    plugin={plugin}
                    conflicts={conflictsFor(plugin.manifest.id)}
                    busy={busy}
                    onOpen={() => setSelectedId(plugin.manifest.id)}
                    onEnable={() => void enablePlugin(plugin.manifest.id)}
                    onDisable={() => void disablePlugin(plugin.manifest.id)}
                    t={t}
                  />
                ))
              )}
            </div>
          </Section>

          <Section className="plugin-manager__section" aria-label={t('plugins.manager.section.install')}>
            <div className="plugin-manager__section-head">
              <Text as="span" className="plugin-manager__section-title">
                {t('plugins.manager.section.install')}
              </Text>
              <Text as="small" tone="muted" className="plugin-manager__section-hint">
                {t('plugins.manager.section.install_hint')}
              </Text>
            </div>

            <InstallPanel onInstalled={onInstalled} t={t} />
          </Section>
        </div>
      </SquareScrollArea>

      <ModalContainer aberto={selected !== null} placement="center" onClose={() => setSelectedId(null)}>
        {selected && (
          <ModalContent titulo={selected.manifest.title} placement="center" amplo onClose={() => setSelectedId(null)}>
            <PluginDetails
              plugin={selected}
              conflicts={conflictsFor(selected.manifest.id)}
              disabledPermissions={disabledPermissions[selected.manifest.id]}
              busy={busy}
              onEnable={() => void enablePlugin(selected.manifest.id)}
              onDisable={() => void disablePlugin(selected.manifest.id)}
              onUninstall={() => void uninstallPlugin(selected.manifest.id)}
              onDeleteData={() => void deletePluginData(selected.manifest.id)}
              onTogglePermission={(permission, allow) =>
                togglePermission(selected.manifest.id, permission, allow)
              }
              t={t}
            />
          </ModalContent>
        )}
      </ModalContainer>
    </Container>
  )
}

/// One row in the installed list: icon, title, version/publisher byline, the
/// trust badge, an enabled toggle, and a button into the full review. The toggle
/// only disables, or enables when activation is clearly allowed; a plugin that is
/// trust-blocked, fatally-conflicted, or unsigned-and-unacknowledged cannot be
/// enabled inline — its toggle is disabled and the user enables it from the
/// detail modal (where the unsigned acknowledgement and full gate live).
function PluginCard({
  plugin,
  conflicts,
  busy,
  onOpen,
  onEnable,
  onDisable,
  t,
}: {
  plugin: InstalledPlugin
  conflicts: readonly PluginConflict[]
  busy: boolean
  onOpen: () => void
  onEnable: () => void
  onDisable: () => void
  t: TFn
}) {
  const { manifest, trust, state } = plugin
  const enabled = state === 'enabled'

  // The fatal/trust gate the host enforces; an unsigned package additionally
  // needs the explicit acknowledgement the detail modal owns, so inline enabling
  // of an unsigned plugin is routed there rather than allowed here.
  const trustBlocks = trustBadge(trust).blocking
  const hasFatalConflict = conflicts.some((conflict) => conflict.severity === 'fatal')
  const needsReview = trust === 'unsigned'
  const enableBlockedInline = trustBlocks || hasFatalConflict || needsReview

  return (
    <Card className={cx('plugin-card', enabled && 'plugin-card--enabled')}>
      <button
        type="button"
        className="plugin-card__open"
        onClick={onOpen}
        aria-label={t('plugins.manager.open_details', { title: manifest.title })}
      >
        <PluginCardIcon icon={manifest.icon} title={manifest.title} />
        <span className="plugin-card__meta">
          <Text as="span" className="plugin-card__title">
            {manifest.title}
          </Text>
          <Text as="small" tone="muted" className="plugin-card__byline">
            {t('plugins.manager.byline', {
              version: manifest.version,
              publisher: manifest.publisher || t('plugins.manager.unknown_publisher'),
            })}
          </Text>
          {manifest.short_description && (
            <Text as="small" tone="subtle" className="plugin-card__summary">
              {manifest.short_description}
            </Text>
          )}
        </span>
      </button>

      <div className="plugin-card__side">
        <TrustBadge status={trust} t={t} className="plugin-card__trust" />
        <Checkbox
          className="plugin-card__toggle"
          checked={enabled}
          disabled={busy || (!enabled && enableBlockedInline)}
          aria-label={t(enabled ? 'plugins.manager.disable' : 'plugins.manager.enable')}
          onCheckedChange={(next) => (next ? onEnable() : onDisable())}
          label={
            <Text as="small" tone="muted">
              {t(enabled ? 'plugins.manager.state.enabled' : 'plugins.manager.state.disabled')}
            </Text>
          }
        />
        {!enabled && enableBlockedInline && (
          <Button variant="quiet" size="mini" type="button" disabled={busy} onClick={onOpen}>
            {t('plugins.manager.review')}
          </Button>
        )}
      </div>
    </Card>
  )
}

/// The plugin's manifest icon, or a lettered fallback tile when none is declared.
/// The icon string is a URL the host serves; it is never executed.
function PluginCardIcon({ icon, title }: { icon: string; title: string }) {
  if (icon) {
    return <img className="plugin-card__icon" src={icon} alt="" />
  }
  return (
    <span className="plugin-card__icon plugin-card__icon--fallback" aria-hidden="true">
      {title.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/// Re-exported for callers that want the screen's nav glyph without importing
/// Lucide directly (Shell registers the native `plugins` screen with it).
export const PluginManagerIcon = Blocks
