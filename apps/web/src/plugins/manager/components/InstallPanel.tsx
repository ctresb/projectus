// The install surface of the plugin manager: a drag-drop `.zip` dropzone and a
// URL paste field, wired to the two backend install pipelines
// (`pluginApi.install` / `pluginApi.installUrl`). The backend is the sole durable
// writer and the verification authority — this panel only feeds it a package and
// surfaces the disabled record it returns.
//
// An installed plugin always lands `state: 'disabled'`; enabling is a separate,
// deliberate step. So on success this panel shows a *pre-activation* summary of
// the freshly installed record (icon, title, version, publisher, trust badge) and
// hands the record up via `onInstalled`, letting the manager open the full
// `PluginDetails` review before the user enables it. Unsigned packages are
// integrity-valid but not signed; the backend gates them behind an explicit
// `allow_unsigned`, so the panel requires an opt-in confirm checkbox before it
// will forward that flag.
//
// Layout mirrors the other native surfaces (Settings/Archive cards): the install
// area is its own titled Card broken into spaced blocks — a generous dropzone, a
// labelled URL field + install button on their own row, and the unsigned opt-in
// laid out as a label with a muted description on separate lines, never crammed
// into one line.
//
// Core stays plugin-agnostic: nothing here names a specific plugin id. Only
// existing UI primitives are reused; no new deps.

import { useRef, useState, type DragEvent } from 'react'
import { Download, Link2, UploadCloud } from 'lucide-react'
import { Button, Card, Checkbox, Field, Input, Text } from '../../../components/ui'
import { ApiFailure } from '../../../lib/api'
import { cx } from '../../../lib/classnames'
import { pluginApi, type InstalledPluginRecord } from '../../lib/pluginApi'
import { TrustBadge } from './TrustBadge'
import type { TFn } from '../../../i18n'

/// The single accepted package extension. The backend treats any binary field as
/// the payload, but the UI filters to `.zip` so the user can't pick a stray file.
const PACKAGE_EXTENSION = '.zip'

/// Whether a dropped/picked file looks like a plugin package. A defensive UI
/// filter only — the backend re-validates and is the authority.
function isPackage(file: File): boolean {
  return file.name.toLowerCase().endsWith(PACKAGE_EXTENSION)
}

export function InstallPanel({
  onInstalled,
  t,
}: {
  /// Called with the freshly installed (always-disabled) record after either
  /// pipeline succeeds, so the manager can open the pre-activation review.
  onInstalled: (record: InstalledPluginRecord) => void
  t: TFn
}) {
  const [url, setUrl] = useState('')
  const [allowUnsigned, setAllowUnsigned] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<InstalledPluginRecord | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Run an install pipeline, funnelling both success (surface the disabled record
  // + notify the parent) and failure (a localized message) through one place.
  const run = async (install: () => Promise<InstalledPluginRecord>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const record = await install()
      setInstalled(record)
      onInstalled(record)
    } catch (cause) {
      setError(cause instanceof ApiFailure ? cause.message : t('plugins.install.error'))
    } finally {
      setBusy(false)
    }
  }

  const installFile = (file: File) => {
    if (!isPackage(file)) {
      setError(t('plugins.install.invalid_file'))
      return
    }
    void run(() => pluginApi.install(file, { allowUnsigned }))
  }

  const installUrl = () => {
    const trimmed = url.trim()
    if (trimmed.length === 0) return
    void run(() => pluginApi.installUrl(trimmed, { allowUnsigned }))
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    if (busy) return
    const file = event.dataTransfer.files.item(0)
    if (file) installFile(file)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!busy) setDragActive(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    // Only clear when the pointer leaves the dropzone itself, not a child.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragActive(false)
  }

  const openPicker = () => {
    if (!busy) fileInput.current?.click()
  }

  return (
    <Card className="plugin-install">
      <header className="plugin-install__head">
        <Text as="span" className="plugin-install__title">
          {t('plugins.install.title')}
        </Text>
        <Text as="small" tone="muted" className="plugin-install__subtitle">
          {t('plugins.install.subtitle')}
        </Text>
      </header>

      <div
        className={cx(
          'plugin-install__dropzone',
          dragActive && 'plugin-install__dropzone--active',
          busy && 'plugin-install__dropzone--busy',
        )}
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker()
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span className="plugin-install__dropzone-icon" aria-hidden="true">
          <UploadCloud size={22} />
        </span>
        <Text as="span" className="plugin-install__dropzone-title">
          {t('plugins.install.dropzone.title')}
        </Text>
        <Text as="small" tone="muted" className="plugin-install__dropzone-hint">
          {t('plugins.install.dropzone.hint')}
        </Text>
        <input
          ref={fileInput}
          className="plugin-install__file"
          type="file"
          accept={PACKAGE_EXTENSION}
          hidden
          onChange={(event) => {
            const file = event.target.files?.item(0)
            // Reset so picking the same file twice still fires `change`.
            event.target.value = ''
            if (file) installFile(file)
          }}
        />
      </div>

      <form
        className="plugin-install__url"
        onSubmit={(event) => {
          event.preventDefault()
          installUrl()
        }}
      >
        <Field
          className="plugin-install__url-field"
          label={
            <span className="plugin-install__url-label">{t('plugins.install.url.label')}</span>
          }
          hint={t('plugins.install.url.hint')}
        >
          <span className="plugin-install__url-control">
            <span className="plugin-install__url-input">
              <Link2 className="plugin-install__url-icon" size={16} aria-hidden="true" />
              <Input
                type="url"
                inputMode="url"
                value={url}
                disabled={busy}
                placeholder={t('plugins.install.url.placeholder')}
                onChange={(event) => setUrl(event.target.value)}
              />
            </span>
            <Button
              type="submit"
              variant="primary"
              className="plugin-install__url-action"
              disabled={busy || url.trim().length === 0}
            >
              <Download size={16} aria-hidden="true" />
              {t('plugins.install.url.action')}
            </Button>
          </span>
        </Field>
      </form>

      <Checkbox
        className="plugin-install__unsigned"
        checked={allowUnsigned}
        disabled={busy}
        onCheckedChange={setAllowUnsigned}
        label={
          <span className="plugin-install__unsigned-copy">
            <Text as="span" className="plugin-install__unsigned-label">
              {t('plugins.install.allow_unsigned.label')}
            </Text>
            <Text as="small" tone="muted" className="plugin-install__unsigned-description">
              {t('plugins.install.allow_unsigned.description')}
            </Text>
          </span>
        }
      />

      {busy && (
        <Text tone="muted" as="small" className="plugin-install__status">
          {t('plugins.install.installing')}
        </Text>
      )}

      {error && (
        <Text tone="danger" as="small" role="alert" className="plugin-install__error">
          {error}
        </Text>
      )}

      {installed && (
        <Card className="plugin-install__preview">
          <Text as="span" className="plugin-install__preview-title">
            {t('plugins.install.preview.title')}
          </Text>
          <div className="plugin-install__preview-head">
            {installed.manifest.icon ? (
              <img className="plugin-install__preview-icon" src={installed.manifest.icon} alt="" />
            ) : null}
            <div className="plugin-install__preview-meta">
              <Text as="span" className="plugin-install__preview-name">
                {installed.manifest.title}
              </Text>
              <Text as="small" tone="muted">
                {t('plugins.install.preview.byline', {
                  version: installed.manifest.version,
                  publisher: installed.manifest.publisher,
                })}
              </Text>
            </div>
            <TrustBadge status={installed.trust} t={t} />
          </div>
          <Text as="small" tone="muted" className="plugin-install__preview-notice">
            {t('plugins.install.preview.disabled_notice')}
          </Text>
        </Card>
      )}
    </Card>
  )
}
