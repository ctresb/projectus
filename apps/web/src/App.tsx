import { useCallback, useEffect, useState } from 'react'
import { Search, Server, ShieldCheck } from 'lucide-react'
import { Notice, type NoticeValue } from './components/Notice'
import type { Board, Config, Ideas } from './lib/types'
import type { ConnectionConfig, DiscoveredServer } from './lib/api'
import { api, discoverServers, getApiConnection, loadSavedConnection, saveConnection } from './lib/api'
import { useWorkspace } from './hooks/useWorkspace'
import { BackupView } from './features/backup/BackupView'
import { ArchiveView } from './features/archive/ArchiveView'
import { ProjectDetail } from './features/boards/ProjectDetail'
import { ProjectsView } from './features/boards/ProjectsView'
import { IdeasView } from './features/ideas/IdeasView'
import { SettingsView } from './features/settings/SettingsView'
import { Shell, type Screen } from './features/shell/Shell'
import { REQUIRED_API_VERSION, ServerVersionRecovery } from './features/shell/ServerVersionRecovery'
import { I18nProvider } from './i18n'
import { Button, ErrorState, LoadingState } from './components/ui'

export function App() {
  const [connectionReady, setConnectionReady] = useState(false)
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionDraft, setConnectionDraft] = useState<ConnectionConfig>(getApiConnection())
  const { workspace, setWorkspace, erro, carregando, refresh } = useWorkspace(connectionReady)
  const [screen, setScreen] = useState<Screen>('projetos')
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeValue>(null)

  const message = useCallback((tipo: 'ok' | 'erro' | 'info', texto: string) => {
    setNotice({ tipo, texto })
  }, [])

  useEffect(() => {
    void loadSavedConnection()
      .then((saved) => {
        if (saved?.api_token) {
          setConnectionDraft(saved)
          setConnectionReady(true)
        }
      })
      .finally(() => setConnectionLoading(false))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const color = workspace?.config.cor_principal
    if (color) document.documentElement.style.setProperty('--accent', color)
  }, [workspace?.config.cor_principal])

  const connect = async (next: ConnectionConfig) => {
    await api.validateConnection(next)
    const saved = await saveConnection(next)
    setConnectionDraft(saved)
    setConnectionReady(true)
    await refresh()
  }

  if (connectionLoading) return <LoadingState className="boot">carregando conexão<span className="cursor" /></LoadingState>
  if (!connectionReady)
    return (
      <ConnectionGate
        initial={connectionDraft}
        onConnect={connect}
        onMessage={(type, text) => message(type, text)}
      />
    )
  if (carregando) return <LoadingState className="boot">conectando ao projectus-server<span className="cursor" /></LoadingState>
  if (!workspace)
    return (
      <ErrorState className="boot boot--error">
        <p>ERR / {erro ?? 'backend local indisponível'}</p>
        <Button type="button" onClick={() => void refresh()}>
          tentar novamente
        </Button>
        <Button
          type="button"
          onClick={() => {
            setConnectionReady(false)
            setConnectionDraft(getApiConnection())
          }}
        >
          trocar servidor
        </Button>
      </ErrorState>
    )
  if (workspace.capacidades?.api_version !== REQUIRED_API_VERSION)
    return (
      <I18nProvider locale={workspace.config.idioma}>
        <ServerVersionRecovery version={workspace.capacidades?.api_version} onRecovered={refresh} />
      </I18nProvider>
    )

  const projectCard = workspace.board.projetos.find((project) => project.id === openProject)
  const setBoard = (board: Board) => setWorkspace({ ...workspace, board })
  const setIdeas = (ideias: Ideas) => setWorkspace({ ...workspace, ideias })
  const setConfig = (config: Config) => setWorkspace({ ...workspace, config })

  const navigate = (next: Screen) => {
    setScreen(next)
    setOpenProject(null)
  }

  return (
    <I18nProvider locale={workspace.config.idioma}>
    <Shell
      screen={screen}
      projectTitle={projectCard?.titulo}
      config={workspace.config}
      onNavigate={navigate}
      onSnapshotError={(text) => message('erro', text)}
    >
      {screen === 'projetos' &&
        (projectCard ? (
          <ProjectDetail
            id={projectCard.id}
            card={projectCard}
            config={workspace.config}
            onBack={() => setOpenProject(null)}
            onRefresh={refresh}
            onMessage={message}
          />
        ) : (
          <ProjectsView
            config={workspace.config}
            board={workspace.board}
            onBoard={setBoard}
            onOpen={setOpenProject}
            onRefresh={refresh}
            onMessage={message}
          />
        ))}
      {screen === 'ideias' && (
        <IdeasView config={workspace.config} ideas={workspace.ideias} onIdeas={setIdeas} onMessage={message} />
      )}
      {screen === 'backup' && <BackupView config={workspace.config} onMessage={message} />}
      {screen === 'arquivo' && (
        <ArchiveView onRefresh={refresh} onMessage={message} />
      )}
      {screen === 'config' && <SettingsView config={workspace.config} onConfig={setConfig} onMessage={message} />}
      <Notice notice={notice} />
    </Shell>
    </I18nProvider>
  )
}

function ConnectionGate({
  initial,
  onConnect,
  onMessage,
}: {
  initial: ConnectionConfig
  onConnect: (connection: ConnectionConfig) => Promise<void>
  onMessage: (type: 'ok' | 'erro' | 'info', text: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [servers, setServers] = useState<DiscoveredServer[]>([])
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await onConnect(draft)
      onMessage('ok', 'conexão salva')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível conectar')
    } finally {
      setBusy(false)
    }
  }

  const detect = async () => {
    setBusy(true)
    try {
      const found = await discoverServers()
      setServers(found)
      if (found[0]) setDraft((current) => ({ ...current, server_url: found[0].server_url }))
      onMessage(found.length ? 'ok' : 'info', found.length ? 'servidor encontrado' : 'nenhum servidor encontrado na rede')
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'falha ao detectar servidor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="connection-gate">
      <section className="connection-panel">
        <header>
          <Server size={28} />
          <div>
            <span className="eyebrow">PROJECTUS</span>
            <h1>conectar servidor</h1>
          </div>
        </header>
        <label className="connection-field">
          <span>endereço do PROJECTUS-SERVER</span>
          <input
            value={draft.server_url}
            placeholder="http://127.0.0.1:4387"
            onChange={(event) => setDraft({ ...draft, server_url: event.target.value })}
          />
        </label>
        <label className="connection-field">
          <span>token</span>
          <input
            value={draft.api_token}
            type="password"
            placeholder="cole o token copiado no PROJECTUS-SERVER"
            onChange={(event) => setDraft({ ...draft, api_token: event.target.value })}
          />
        </label>
        <div className="connection-actions">
          <Button type="button" disabled={busy} onClick={() => void detect()}>
            <Search size={15} /> detectar server
          </Button>
          <Button type="button" variant="primary" disabled={busy || !draft.server_url.trim() || !draft.api_token.trim()} onClick={() => void submit()}>
            <ShieldCheck size={15} /> conectar
          </Button>
        </div>
        {servers.length > 0 && (
          <div className="connection-results">
            {servers.map((server) => (
              <button
                type="button"
                key={server.server_url}
                onClick={() => setDraft((current) => ({ ...current, server_url: server.server_url }))}
              >
                <strong>{server.server_url}</strong>
                <span>{server.produto} {server.versao}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
