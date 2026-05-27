import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import type { BackupCredentialStatus, Column, Config, DaemonStatus, Tag } from '../../lib/types'
import { ColorPicker } from '../../components/ColorPicker'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { itemId } from '../../lib/ids'
import { markError, markSaved, markSaving } from '../../hooks/useSaveStatus'
import { LOCALES, useT } from '../../i18n'

function isR2S3Endpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.r2.cloudflarestorage.com') &&
      (url.pathname === '' || url.pathname === '/')
    )
  } catch {
    return false
  }
}

export function SettingsView({
  config,
  onConfig,
  onMessage,
}: {
  config: Config
  onConfig: (config: Config) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(config)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [credentialStatus, setCredentialStatus] = useState<BackupCredentialStatus | null>(null)
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  const [showCloudflareHelp, setShowCloudflareHelp] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const validR2Endpoint = isR2S3Endpoint(draft.r2.endpoint)
  const draftRef = useRef(config)
  useEffect(() => {
    if (dirty || saving) return
    draftRef.current = config
    setDraft(config)
  }, [config, dirty, saving])
  useEffect(() => {
    void api.daemonStatus().then(setDaemon).catch(() => undefined)
    void api.credentialStatus().then(setCredentialStatus).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!dirty || saving) return
    markSaving()
    const timer = window.setTimeout(() => {
      const submitted = draftRef.current
      setDirty(false)
      setSaving(true)
      void api
        .updateConfig(submitted)
        .then((saved) => {
          const hasNewerChange = draftRef.current !== submitted
          const next = hasNewerChange ? { ...draftRef.current, revision: saved.revision } : saved
          draftRef.current = next
          setDraft(next)
          onConfig(next)
          if (hasNewerChange) setDirty(true)
          else markSaved()
        })
        .catch(async (error: Error) => {
          markError(error.message)
          onMessage('erro', error.message)
          const fresh = (await api.bootstrap()).config
          draftRef.current = fresh
          setDraft(fresh)
          onConfig(fresh)
        })
        .finally(() => setSaving(false))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [dirty, onConfig, onMessage, saving])

  const change = (next: Config) => {
    draftRef.current = next
    setDraft(next)
    onConfig(next)
    setDirty(true)
  }

  const saveCredentials = async () => {
    try {
      await api.saveCredentials({ access_key_id: accessKey.trim(), secret_access_key: secretKey.trim() })
      setAccessKey('')
      setSecretKey('')
      setCredentialStatus(await api.credentialStatus())
      onMessage('ok', t('settings.creds_saved'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('settings.creds_fail'))
    }
  }

  const addTag = () => {
    const titulo = t('settings.tags.default_new_title')
    const id = itemId('tag', titulo)
    change({ ...draft, tags: [...draft.tags, { id, titulo, cor: draft.cores[0].valor }] })
  }
  const updateTag = (id: string, update: Partial<Tag>) =>
    change({ ...draft, tags: draft.tags.map((tag) => (tag.id === id ? { ...tag, ...update } : tag)) })
  const addColumn = () => {
    const titulo = t('settings.columns.default_new_title')
    const column: Column = {
      id: itemId('coluna', 'nova coluna'),
      titulo,
      cor: draft.cores[0].valor,
    }
    change({ ...draft, colunas: [...draft.colunas, column] })
  }
  const removeColumn = (id: string) => {
    if (draft.colunas.length === 1) {
      onMessage('erro', t('settings.min_one_column'))
      return
    }
    change({ ...draft, colunas: draft.colunas.filter((column) => column.id !== id) })
  }
  const moveColumn = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= draft.colunas.length) return
    const columns = [...draft.colunas]
    const [column] = columns.splice(index, 1)
    columns.splice(destination, 0, column)
    change({ ...draft, colunas: columns })
  }

  return (
    <section className="settings workspace">
      <header className="section-head">
        <div>
          <span className="eyebrow">{t('settings.eyebrow')}</span>
          <h1>{t('settings.title')}</h1>
        </div>
        <span className="settings-autosave">{dirty || saving ? t('settings.autosaving') : t('settings.autosaved')}</span>
      </header>
      <SquareScrollArea viewportClassName="settings-scroll">
      <div className="settings-grid">
        <section className="panel">
          <header>
            {t('settings.columns.header')}
            <button className="btn btn--mini" onClick={addColumn} type="button">
              <Plus size={13} /> {t('settings.columns.add')}
            </button>
          </header>
          <SquareScrollArea className="panel__scroll" viewportClassName="panel__scroll-viewport">
            {draft.colunas.map((column, index) => (
              <div className="setting-row setting-row--column" key={column.id}>
                <span className="setting-row__index">{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={column.titulo}
                  onChange={(event) =>
                    change({
                      ...draft,
                      colunas: draft.colunas.map((item) =>
                        item.id === column.id ? { ...item, titulo: event.target.value.toUpperCase() } : item,
                      ),
                    })
                  }
                />
                <ColorPicker
                  cores={draft.cores}
                  value={column.cor}
                  label={t('settings.columns.label_color', { titulo: column.titulo })}
                  onChange={(value) =>
                    change({
                      ...draft,
                      colunas: draft.colunas.map((item) => (item.id === column.id ? { ...item, cor: value } : item)),
                    })
                  }
                />
                <div className="setting-row__actions">
                  <button className="icon-btn" type="button" aria-label={t('settings.columns.aria_up')} onClick={() => moveColumn(index, -1)}>
                    <ArrowUp size={13} />
                  </button>
                  <button className="icon-btn" type="button" aria-label={t('settings.columns.aria_down')} onClick={() => moveColumn(index, 1)}>
                    <ArrowDown size={13} />
                  </button>
                  <button className="icon-btn icon-btn--danger" type="button" aria-label={t('settings.columns.aria_remove')} onClick={() => removeColumn(column.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </SquareScrollArea>
        </section>
        <section className="panel">
          <header>
            {t('settings.tags.header')}
            <button className="btn btn--mini" onClick={addTag} type="button">
              <Plus size={13} /> {t('settings.tags.add')}
            </button>
          </header>
          <SquareScrollArea className="panel__scroll" viewportClassName="panel__scroll-viewport">
            {draft.tags.map((tag) => (
              <div className="setting-row setting-row--tag" key={tag.id}>
                <input value={tag.titulo} onChange={(event) => updateTag(tag.id, { titulo: event.target.value })} />
                <span className="tag-choice tag-choice--active setting-row__tag-preview" style={{ '--tag-color': tag.cor } as CSSProperties}>
                  {tag.titulo.trim() || t('settings.tags.preview_empty')}
                </span>
                <ColorPicker
                  cores={draft.cores}
                  value={tag.cor}
                  label={t('settings.tags.label_color', { titulo: tag.titulo })}
                  onChange={(cor) => updateTag(tag.id, { cor })}
                />
                <button
                  className="icon-btn icon-btn--danger"
                  type="button"
                  aria-label={t('settings.tags.aria_remove')}
                  onClick={() => change({ ...draft, tags: draft.tags.filter((item) => item.id !== tag.id) })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {draft.tags.length === 0 && <p className="panel-empty">{t('settings.tags.empty')}</p>}
          </SquareScrollArea>
        </section>
        <section className="panel">
          <header>{t('settings.theme.header')}</header>
          <span className="field-label">{t('settings.theme.label_primary')}</span>
          <p className="panel-copy">{t('settings.theme.description')}</p>
          <ColorPicker
            cores={draft.cores}
            value={draft.cor_principal ?? '#55B9F7'}
            label={t('settings.theme.label_primary_aria')}
            onChange={(value) => change({ ...draft, cor_principal: value })}
          />
        </section>
        <section className="panel">
          <header>{t('settings.language.header')}</header>
          <label>
            {t('settings.language.label')}
            <select
              value={draft.idioma}
              onChange={(event) => change({ ...draft, idioma: event.target.value })}
            >
              {Object.entries(LOCALES).map(([id, { label }]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="panel">
          <header>{t('settings.r2.header')}</header>
          <button
            type="button"
            className="btn btn--mini btn--mini--inline"
            onClick={() => setShowCloudflareHelp((current) => !current)}
          >
            <Info size={12} /> {showCloudflareHelp ? t('settings.r2.hide_help') : t('settings.r2.show_help')}
          </button>
          {showCloudflareHelp && (
            <div className="r2-help">
              <p><strong>{t('settings.r2.help_title')}</strong></p>
              <ul>
                <li>
                  <strong>{t('settings.r2.label_endpoint')}</strong> — em R2 → painel da conta, copie o endpoint <code>S3 API</code>
                  (formato <code>https://&lt;account-id&gt;.r2.cloudflarestorage.com</code>).
                  <br />
                  <em>não</em> use o domínio personalizado do bucket — ele serve só ao tráfego público, não à API S3.
                </li>
                <li>
                  <strong>{t('settings.r2.label_bucket')}</strong> — o <em>nome</em> do bucket no R2 (não a URL pública).
                </li>
                <li>
                  <strong>{t('settings.r2.label_access')}</strong> e <strong>{t('settings.r2.label_secret')}</strong> — em R2 → <em>Manage R2 API tokens</em>,
                  criar um token. Use os valores listados em <em>Use the following credentials for S3 clients</em>.
                  O <em>Token Value</em> separado é só para a API HTTP da Cloudflare, ignore aqui.
                </li>
              </ul>
            </div>
          )}
          <label>
            {t('settings.r2.label_endpoint')}
            <input
              placeholder={t('settings.r2.placeholder_endpoint')}
              value={draft.r2.endpoint}
              onChange={(event) => change({ ...draft, r2: { ...draft.r2, endpoint: event.target.value } })}
            />
            <small className="hint">{t('settings.r2.hint_endpoint')}</small>
            {draft.r2.endpoint.trim() && !validR2Endpoint && (
              <small className="field-error">
                {t('settings.r2.error_endpoint')}
              </small>
            )}
          </label>
          <label>
            {t('settings.r2.label_bucket')}
            <input
              value={draft.r2.bucket}
              onChange={(event) => change({ ...draft, r2: { ...draft.r2, bucket: event.target.value } })}
            />
            <small className="hint">{t('settings.r2.hint_bucket')}</small>
          </label>
          <label>
            {t('settings.r2.label_access')}
            <input
              autoComplete="off"
              placeholder={credentialStatus?.access_key_id_mascarada ?? ''}
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
            />
            <small className="hint">{t('settings.r2.hint_access')}</small>
          </label>
          <label>
            {t('settings.r2.label_secret')}
            <input
              autoComplete="new-password"
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
            />
            <small className="hint">{t('settings.r2.hint_secret')}</small>
          </label>
          <div className={credentialStatus?.fixadas ? 'credential-state credential-state--ok' : 'credential-state'}>
            <strong>{t('settings.r2.keychain')}</strong>
            <span>
              {credentialStatus?.fixadas
                ? t('settings.r2.creds_fixed', { access_key_id: credentialStatus.access_key_id_mascarada ?? '' })
                : t('settings.r2.creds_empty')}
            </span>
          </div>
          <button
            className="btn btn--quiet"
            type="button"
            disabled={!accessKey.trim() || !secretKey.trim() || dirty || saving || !validR2Endpoint}
            onClick={() => void saveCredentials()}
          >
            {t('settings.r2.save_button')}
          </button>
        </section>
        <section className="panel">
          <header>{t('settings.server.header')}</header>
          <label>
            {t('settings.server.label_port')}
            <input
              type="number"
              value={draft.porta}
              onChange={(event) => change({ ...draft, porta: Number(event.target.value) })}
            />
          </label>
          <p className="panel-copy">
            {t('settings.server.description', { porta: draft.porta })}
          </p>
          <p className="panel-copy">
            {daemon?.instalado
              ? t('settings.server.autostart_installed')
              : daemon?.instalacao_disponivel
                ? t('settings.server.autostart_available')
                : t('settings.server.autostart_unavailable')}
          </p>
          {!daemon?.instalado && daemon?.instalacao_disponivel && (
            <button
              className="btn btn--quiet"
              type="button"
              onClick={async () => {
                try {
                  setDaemon(await api.installDaemon())
                  onMessage('ok', t('settings.autostart_installed'))
                } catch (error) {
                  onMessage('erro', error instanceof Error ? error.message : t('settings.autostart_fail'))
                }
              }}
            >
              {t('settings.server.install_button')}
            </button>
          )}
        </section>
      </div>
      </SquareScrollArea>
    </section>
  )
}
