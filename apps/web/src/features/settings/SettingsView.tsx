import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import type { BackupCredentialStatus, Column, Config, DaemonStatus, Tag } from '../../lib/types'
import { ColorPicker } from '../../components/ColorPicker'
import { itemId } from '../../lib/ids'

export function SettingsView({
  config,
  onConfig,
  onMessage,
}: {
  config: Config
  onConfig: (config: Config) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [draft, setDraft] = useState(config)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [credentialStatus, setCredentialStatus] = useState<BackupCredentialStatus | null>(null)
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  useEffect(() => setDraft(config), [config])
  useEffect(() => {
    void api.daemonStatus().then(setDaemon).catch(() => undefined)
    void api.credentialStatus().then(setCredentialStatus).catch(() => undefined)
  }, [])

  const save = async () => {
    try {
      const saved = await api.updateConfig(draft)
      onConfig(saved)
      onMessage('ok', 'configurações salvas')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível salvar')
    }
  }

  const addTag = () => {
    const id = itemId('tag', 'nova tag')
    setDraft({ ...draft, tags: [...draft.tags, { id, titulo: 'nova tag', cor: draft.cores[0].valor }] })
  }
  const updateTag = (id: string, change: Partial<Tag>) =>
    setDraft({ ...draft, tags: draft.tags.map((tag) => (tag.id === id ? { ...tag, ...change } : tag)) })
  const addColumn = () => {
    const column: Column = {
      id: itemId('coluna', 'nova coluna'),
      titulo: 'NOVA COLUNA',
      cor: draft.cores[0].valor,
    }
    setDraft({ ...draft, colunas: [...draft.colunas, column] })
  }
  const removeColumn = (id: string) => {
    if (draft.colunas.length === 1) {
      onMessage('erro', 'mantenha pelo menos uma coluna')
      return
    }
    setDraft({ ...draft, colunas: draft.colunas.filter((column) => column.id !== id) })
  }
  const moveColumn = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= draft.colunas.length) return
    const columns = [...draft.colunas]
    const [column] = columns.splice(index, 1)
    columns.splice(destination, 0, column)
    setDraft({ ...draft, colunas: columns })
  }

  const fixR2 = async () => {
    if (!draft.r2.endpoint.trim() || !draft.r2.bucket.trim()) {
      onMessage('erro', 'informe endpoint e bucket do R2')
      return
    }
    const hasNewCredentials = Boolean(accessKey.trim() || secretKey.trim())
    if (hasNewCredentials && (!accessKey.trim() || !secretKey.trim())) {
      onMessage('erro', 'informe o ID e a chave secreta do R2')
      return
    }
    if (!hasNewCredentials && !credentialStatus?.fixadas) {
      onMessage('erro', 'informe as credenciais para fixar no Keychain')
      return
    }
    try {
      await api.updateConfig(draft)
      if (hasNewCredentials) {
        await api.saveCredentials({ access_key_id: accessKey.trim(), secret_access_key: secretKey.trim() })
        setAccessKey('')
        setSecretKey('')
      }
      const [workspace, status] = await Promise.all([api.bootstrap(), api.credentialStatus()])
      setDraft(workspace.config)
      setCredentialStatus(status)
      onConfig(workspace.config)
      onMessage('ok', status.fixadas ? 'R2 fixado; credenciais protegidas no Keychain' : 'configuração R2 salva')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'falha ao fixar R2')
    }
  }

  return (
    <section className="settings workspace">
      <header className="section-head">
        <div>
          <span className="eyebrow">config</span>
          <h1>configurações</h1>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => void save()}>
          salvar localmente
        </button>
      </header>
      <div className="settings-grid">
        <section className="panel">
          <header>
            colunas padrão
            <button className="btn btn--mini" onClick={addColumn} type="button">
              <Plus size={13} /> coluna
            </button>
          </header>
          <div className="panel__scroll">
            {draft.colunas.map((column, index) => (
              <div className="setting-row setting-row--column" key={column.id}>
                <span className="setting-row__index">{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={column.titulo}
                  onChange={(event) =>
                    setDraft({
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
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      colunas: draft.colunas.map((item) => (item.id === column.id ? { ...item, cor: value } : item)),
                    })
                  }
                />
                <div className="setting-row__actions">
                  <button className="icon-btn" type="button" aria-label="Mover coluna para cima" onClick={() => moveColumn(index, -1)}>
                    <ArrowUp size={13} />
                  </button>
                  <button className="icon-btn" type="button" aria-label="Mover coluna para baixo" onClick={() => moveColumn(index, 1)}>
                    <ArrowDown size={13} />
                  </button>
                  <button className="icon-btn icon-btn--danger" type="button" aria-label="Remover coluna" onClick={() => removeColumn(column.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <header>
            tags
            <button className="btn btn--mini" onClick={addTag} type="button">
              <Plus size={13} /> tag
            </button>
          </header>
          <div className="panel__scroll">
            {draft.tags.map((tag) => (
              <div className="setting-row" key={tag.id}>
                <input value={tag.titulo} onChange={(event) => updateTag(tag.id, { titulo: event.target.value })} />
                <ColorPicker cores={draft.cores} value={tag.cor} onChange={(cor) => updateTag(tag.id, { cor })} />
                <button
                  className="icon-btn icon-btn--danger"
                  type="button"
                  aria-label="Remover tag"
                  onClick={() => setDraft({ ...draft, tags: draft.tags.filter((item) => item.id !== tag.id) })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {draft.tags.length === 0 && <p className="panel-empty">adicione tags para atribuir aos projetos.</p>}
          </div>
        </section>
        <section className="panel">
          <header>cloudflare r2</header>
          <label>
            endereço S3
            <input
              placeholder="https://<conta>.r2.cloudflarestorage.com"
              value={draft.r2.endpoint}
              onChange={(event) => setDraft({ ...draft, r2: { ...draft.r2, endpoint: event.target.value } })}
            />
          </label>
          <label>
            bucket
            <input
              value={draft.r2.bucket}
              onChange={(event) => setDraft({ ...draft, r2: { ...draft.r2, bucket: event.target.value } })}
            />
          </label>
          <label>
            ID da chave de acesso
            <input
              autoComplete="off"
              placeholder={credentialStatus?.access_key_id_mascarada ?? ''}
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
            />
          </label>
          <label>
            chave secreta de acesso
            <input
              autoComplete="new-password"
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
            />
          </label>
          <div className={credentialStatus?.fixadas ? 'credential-state credential-state--ok' : 'credential-state'}>
            <strong>KEYCHAIN</strong>
            <span>
              {credentialStatus?.fixadas
                ? `credenciais fixadas (${credentialStatus.access_key_id_mascarada})`
                : 'nenhuma credencial fixada'}
            </span>
          </div>
          <button
            className="btn btn--quiet"
            type="button"
            onClick={() => void fixR2()}
          >
            fixar configuração e credenciais
          </button>
        </section>
        <section className="panel">
          <header>servidor local</header>
          <label>
            porta
            <input
              type="number"
              value={draft.porta}
              onChange={(event) => setDraft({ ...draft, porta: Number(event.target.value) })}
            />
          </label>
          <p className="panel-copy">
            O servidor escuta em <code>127.0.0.1:{draft.porta}</code>. Use Tailscale Serve para publicar na sua tailnet.
          </p>
          <p className="panel-copy">
            {daemon?.instalado
              ? 'autostart instalado.'
              : daemon?.instalacao_disponivel
                ? 'autostart ainda não instalado.'
                : 'para manter o backend ativo com a janela fechada, execute ./scripts/instalar-autostart.sh.'}
          </p>
          {!daemon?.instalado && daemon?.instalacao_disponivel && (
            <button
              className="btn btn--quiet"
              type="button"
              onClick={async () => {
                try {
                  setDaemon(await api.installDaemon())
                  onMessage('ok', 'autostart instalado no macOS')
                } catch (error) {
                  onMessage('erro', error instanceof Error ? error.message : 'não foi possível instalar')
                }
              }}
            >
              instalar autostart
            </button>
          )}
        </section>
      </div>
    </section>
  )
}
