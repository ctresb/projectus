import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Clipboard, ExternalLink, Power, RefreshCw, RotateCw, Settings, X } from 'lucide-react'
import '@projectus/ui/styles.css'
import './server.css'

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
      }
    }
  }
}

type ServerState = 'starting' | 'online' | 'error'

type ServerStatus = {
  state: ServerState
  message: string | null
  server_url: string
  token_configurado: boolean
  token_mascarado: string | null
  autostart: boolean
  data_root: string
  logs_dir: string
}

const invoke = <T,>(command: string, args?: Record<string, unknown>) => {
  if (!window.__TAURI__) throw new Error('Tauri indisponível')
  return window.__TAURI__.core.invoke<T>(command, args)
}

function App() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setStatus(await invoke<ServerStatus>('server_status'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 1800)
    return () => window.clearInterval(timer)
  }, [])

  const stateLabel = status?.state === 'online' ? 'online' : status?.state === 'error' ? 'erro' : 'iniciando'
  const stateClass = status?.state === 'online' ? 'ok' : status?.state === 'error' ? 'err' : 'warn'

  const copyToken = async () => {
    const token = await invoke<string>('server_token')
    await navigator.clipboard.writeText(token)
    setTokenCopied(true)
    window.setTimeout(() => setTokenCopied(false), 1800)
  }

  const toggleAutostart = async () => {
    if (!status) return
    setStatus(await invoke<ServerStatus>('set_autostart', { enabled: !status.autostart }))
  }

  return (
    <main className="server-shell">
      <header className="server-head">
        <div>
          <strong>PROJECTUS-SERVER</strong>
          <span className={`server-state server-state--${stateClass}`}>{stateLabel}</span>
        </div>
        <button className="server-icon" type="button" aria-label="fechar" onClick={() => void invoke('hide_server_window')}>
          <X size={15} />
        </button>
      </header>

      {view === 'main' ? (
        <section className="server-stack">
          <div className="server-address">
            <span>ENDEREÇO</span>
            <strong>{status?.server_url ?? 'http://127.0.0.1:4387'}</strong>
          </div>

          <div className="server-actions">
            <button className="server-action" type="button" onClick={copyToken}>
              {tokenCopied ? <Check size={15} /> : <Clipboard size={15} />}
              {tokenCopied ? 'token copiado' : status?.token_mascarado ?? 'copiar token'}
            </button>
            <button className="server-action" type="button" onClick={() => void invoke('restart_server_app')}>
              <RotateCw size={15} />
              reiniciar
            </button>
          </div>

          <div className="server-list">
            <Row label="autostart" value={status?.autostart ? 'ligado' : 'desligado'} action={toggleAutostart} />
            <Row label="api" value={status?.token_configurado ? 'protegida por token' : 'sem token'} />
            <Row label="dados" value={compactPath(status?.data_root)} />
            <Row label="logs" value={compactPath(status?.logs_dir)} />
          </div>

          {status?.message && <p className="server-error">ERR / {status.message}</p>}
          {error && <p className="server-error">ERR / {error}</p>}

          <footer className="server-footer">
            <button type="button" onClick={() => setView('settings')}>
              <Settings size={15} /> ajustes
            </button>
            <button type="button" onClick={() => void refresh()}>
              <RefreshCw size={15} /> atualizar
            </button>
          </footer>
        </section>
      ) : (
        <SettingsView
          status={status}
          onBack={() => setView('main')}
          onRefresh={(next) => setStatus(next)}
        />
      )}
    </main>
  )
}

function SettingsView({
  status,
  onBack,
  onRefresh,
}: {
  status: ServerStatus | null
  onBack: () => void
  onRefresh: (status: ServerStatus) => void
}) {
  const rows = useMemo(
    () => [
      ['servidor', status?.server_url ?? ''],
      ['token', status?.token_mascarado ?? 'indisponível'],
      ['dados', status?.data_root ?? ''],
      ['logs', status?.logs_dir ?? ''],
    ],
    [status],
  )
  return (
    <section className="server-stack">
      <div className="settings-title">
        <strong>AJUSTES</strong>
        <button className="server-icon" type="button" aria-label="voltar" onClick={onBack}>
          <ExternalLink size={15} />
        </button>
      </div>
      <div className="server-list">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </div>
      <button
        className="server-action server-action--danger"
        type="button"
        onClick={async () => onRefresh(await invoke<ServerStatus>('regenerate_token'))}
      >
        <RefreshCw size={15} />
        regenerar token
      </button>
      <button className="server-action" type="button" onClick={() => void invoke('quit_server_app')}>
        <Power size={15} />
        desligar servidor
      </button>
      <p className="server-copy">Cloudflare R2 continua sendo salvo via PROJECTUS e persistido com segurança pelo servidor.</p>
    </section>
  )
}

function Row({ label, value, action }: { label: string; value?: string; action?: () => void }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </>
  )
  return action ? (
    <button className="server-row server-row--button" type="button" onClick={action}>
      {content}
    </button>
  ) : (
    <div className="server-row">{content}</div>
  )
}

function compactPath(path?: string) {
  if (!path) return '-'
  return path.replace(/^\/Users\/[^/]+/, '~')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
