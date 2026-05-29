import type { CSSProperties } from 'react'
import '../r2-help.css'
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from 'lucide-react'
import { api } from '../../../lib/api'
import type { BackupCredentialStatus, ColorChoice, Column, DaemonStatus, R2Config, Tag } from '../../../lib/types'
import { ColorPicker } from '../../../components/ColorPicker'
import { SquareScrollArea } from '../../../components/SquareScrollArea'
import { Button, Card, Field, IconButton, Input, Select, Text } from '../../../components/ui'
import { LOCALES, type TFn } from '../../../i18n'

export function ColumnsPanel({
  columns,
  colors,
  onAdd,
  onUpdate,
  onMove,
  onRemove,
  t,
}: {
  columns: Column[]
  colors: ColorChoice[]
  onAdd: () => void
  onUpdate: (id: string, update: Partial<Column>) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (id: string) => void
  t: TFn
}) {
  return (
    <Card
      title={t('settings.columns.header')}
      action={
        <Button size="mini" onClick={onAdd} type="button">
          <Plus size={13} /> {t('settings.columns.add')}
        </Button>
      }
    >
      <SquareScrollArea className="panel__scroll" viewportClassName="panel__scroll-viewport">
        {columns.map((column, index) => (
          <div className="setting-row setting-row--column" key={column.id}>
            <span className="setting-row__index">{String(index + 1).padStart(2, '0')}</span>
            <Input
              value={column.titulo}
              onChange={(event) => onUpdate(column.id, { titulo: event.target.value.toUpperCase() })}
            />
            <ColorPicker
              cores={colors}
              value={column.cor}
              label={t('settings.columns.label_color', { titulo: column.titulo })}
              onChange={(cor) => onUpdate(column.id, { cor })}
            />
            <div className="setting-row__actions">
              <IconButton label={t('settings.columns.aria_up')} onClick={() => onMove(index, -1)}>
                <ArrowUp size={13} />
              </IconButton>
              <IconButton label={t('settings.columns.aria_down')} onClick={() => onMove(index, 1)}>
                <ArrowDown size={13} />
              </IconButton>
              <IconButton tone="danger" label={t('settings.columns.aria_remove')} onClick={() => onRemove(column.id)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
          </div>
        ))}
      </SquareScrollArea>
    </Card>
  )
}

export function TagsPanel({
  tags,
  colors,
  onAdd,
  onUpdate,
  onRemove,
  t,
}: {
  tags: Tag[]
  colors: ColorChoice[]
  onAdd: () => void
  onUpdate: (id: string, update: Partial<Tag>) => void
  onRemove: (id: string) => void
  t: TFn
}) {
  return (
    <Card
      title={t('settings.tags.header')}
      action={
        <Button size="mini" onClick={onAdd} type="button">
          <Plus size={13} /> {t('settings.tags.add')}
        </Button>
      }
    >
      <SquareScrollArea className="panel__scroll" viewportClassName="panel__scroll-viewport">
        {tags.map((tag) => (
          <div className="setting-row setting-row--tag" key={tag.id}>
            <Input value={tag.titulo} onChange={(event) => onUpdate(tag.id, { titulo: event.target.value })} />
            <span
              className="tag-choice tag-choice--active setting-row__tag-preview"
              style={{ '--tag-color': tag.cor } as CSSProperties}
            >
              {tag.titulo.trim() || t('settings.tags.preview_empty')}
            </span>
            <ColorPicker
              cores={colors}
              value={tag.cor}
              label={t('settings.tags.label_color', { titulo: tag.titulo })}
              onChange={(cor) => onUpdate(tag.id, { cor })}
            />
            <IconButton tone="danger" label={t('settings.tags.aria_remove')} onClick={() => onRemove(tag.id)}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
        {tags.length === 0 && <p className="panel-empty">{t('settings.tags.empty')}</p>}
      </SquareScrollArea>
    </Card>
  )
}

export function ThemePanel({
  colors,
  value,
  onChange,
  t,
}: {
  colors: ColorChoice[]
  value: string
  onChange: (value: string) => void
  t: TFn
}) {
  return (
    <Card title={t('settings.theme.header')}>
      <span className="field-label">{t('settings.theme.label_primary')}</span>
      <Text className="panel-copy">{t('settings.theme.description')}</Text>
      <ColorPicker cores={colors} value={value} label={t('settings.theme.label_primary_aria')} onChange={onChange} />
    </Card>
  )
}

export function LanguagePanel({ value, onChange, t }: { value: string; onChange: (value: string) => void; t: TFn }) {
  return (
    <Card title={t('settings.language.header')}>
      <Field label={t('settings.language.label')}>
        <Select
          label={t('settings.language.label')}
          value={value}
          options={Object.entries(LOCALES).map(([id, { label }]) => ({ value: id, label }))}
          onChange={onChange}
        />
      </Field>
    </Card>
  )
}

export function R2Panel({
  r2,
  validEndpoint,
  accessKey,
  secretKey,
  credentialStatus,
  showHelp,
  dirty,
  saving,
  onR2Change,
  onAccessKey,
  onSecretKey,
  onToggleHelp,
  onSaveCredentials,
  t,
}: {
  r2: R2Config
  validEndpoint: boolean
  accessKey: string
  secretKey: string
  credentialStatus: BackupCredentialStatus | null
  showHelp: boolean
  dirty: boolean
  saving: boolean
  onR2Change: (update: Partial<R2Config>) => void
  onAccessKey: (value: string) => void
  onSecretKey: (value: string) => void
  onToggleHelp: () => void
  onSaveCredentials: () => void
  t: TFn
}) {
  return (
    <Card title={t('settings.r2.header')}>
      <Button type="button" size="mini" className="btn--mini--inline" onClick={onToggleHelp}>
        <Info size={12} /> {showHelp ? t('settings.r2.hide_help') : t('settings.r2.show_help')}
      </Button>
      {showHelp && <CloudflareHelp t={t} />}
      <Field
        label={t('settings.r2.label_endpoint')}
        hint={t('settings.r2.hint_endpoint')}
        error={r2.endpoint.trim() && !validEndpoint ? t('settings.r2.error_endpoint') : null}
      >
        <Input
          placeholder={t('settings.r2.placeholder_endpoint')}
          value={r2.endpoint}
          onChange={(event) => onR2Change({ endpoint: event.target.value })}
        />
      </Field>
      <Field label={t('settings.r2.label_bucket')} hint={t('settings.r2.hint_bucket')}>
        <Input value={r2.bucket} onChange={(event) => onR2Change({ bucket: event.target.value })} />
      </Field>
      <Field label={t('settings.r2.label_access')} hint={t('settings.r2.hint_access')}>
        <Input
          autoComplete="off"
          placeholder={credentialStatus?.access_key_id_mascarada ?? ''}
          value={accessKey}
          onChange={(event) => onAccessKey(event.target.value)}
        />
      </Field>
      <Field label={t('settings.r2.label_secret')} hint={t('settings.r2.hint_secret')}>
        <Input
          autoComplete="new-password"
          type="password"
          value={secretKey}
          onChange={(event) => onSecretKey(event.target.value)}
        />
      </Field>
      <div className={credentialStatus?.fixadas ? 'credential-state credential-state--ok' : 'credential-state'}>
        <strong>{t('settings.r2.keychain')}</strong>
        <span>
          {credentialStatus?.fixadas
            ? t('settings.r2.creds_fixed', { access_key_id: credentialStatus.access_key_id_mascarada ?? '' })
            : t('settings.r2.creds_empty')}
        </span>
      </div>
      <Button
        type="button"
        disabled={!accessKey.trim() || !secretKey.trim() || dirty || saving || !validEndpoint}
        onClick={onSaveCredentials}
      >
        {t('settings.r2.save_button')}
      </Button>
    </Card>
  )
}

export function ServerPanel({
  porta,
  daemon,
  onPortChange,
  onDaemonChange,
  onMessage,
  t,
}: {
  porta: number
  daemon: DaemonStatus | null
  onPortChange: (porta: number) => void
  onDaemonChange: (daemon: DaemonStatus) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
  t: TFn
}) {
  return (
    <Card title={t('settings.server.header')}>
      <Field label={t('settings.server.label_port')}>
        <Input type="number" value={porta} onChange={(event) => onPortChange(Number(event.target.value))} />
      </Field>
      <Text className="panel-copy">{t('settings.server.description', { porta })}</Text>
      <Text className="panel-copy">
        {daemon?.instalado
          ? t('settings.server.autostart_installed')
          : daemon?.instalacao_disponivel
            ? t('settings.server.autostart_available')
            : t('settings.server.autostart_unavailable')}
      </Text>
      {!daemon?.instalado && daemon?.instalacao_disponivel && (
        <Button
          type="button"
          onClick={async () => {
            try {
              onDaemonChange(await api.installDaemon())
              onMessage('ok', t('settings.autostart_installed'))
            } catch (error) {
              onMessage('erro', error instanceof Error ? error.message : t('settings.autostart_fail'))
            }
          }}
        >
          {t('settings.server.install_button')}
        </Button>
      )}
    </Card>
  )
}

function CloudflareHelp({ t }: { t: TFn }) {
  return (
    <div className="r2-help">
      <p>
        <strong>{t('settings.r2.help_title')}</strong>
      </p>
      <ul>
        <li>
          <strong>{t('settings.r2.label_endpoint')}</strong> - {t('settings.r2.help_endpoint')}
          <br />
          <em>{t('settings.r2.help_endpoint_note')}</em>
        </li>
        <li>
          <strong>{t('settings.r2.label_bucket')}</strong> - {t('settings.r2.help_bucket')}
        </li>
        <li>
          <strong>{t('settings.r2.label_access')}</strong> / <strong>{t('settings.r2.label_secret')}</strong> -{' '}
          {t('settings.r2.help_access')}
        </li>
      </ul>
    </div>
  )
}
