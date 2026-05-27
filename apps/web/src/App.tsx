import { useCallback, useEffect, useState } from 'react'
import { Notice, type NoticeValue } from './components/Notice'
import type { Board, Config, Ideas } from './lib/types'
import { useWorkspace } from './hooks/useWorkspace'
import { BackupView } from './features/backup/BackupView'
import { ArchiveView } from './features/archive/ArchiveView'
import { ProjectDetail } from './features/boards/ProjectDetail'
import { ProjectsView } from './features/boards/ProjectsView'
import { IdeasView } from './features/ideas/IdeasView'
import { SettingsView } from './features/settings/SettingsView'
import { Shell, type Screen } from './features/shell/Shell'
import { REQUIRED_API_VERSION, ServerVersionRecovery } from './features/shell/ServerVersionRecovery'

export function App() {
  const { workspace, setWorkspace, erro, carregando, refresh } = useWorkspace()
  const [screen, setScreen] = useState<Screen>('projetos')
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeValue>(null)

  const message = useCallback((tipo: 'ok' | 'erro' | 'info', texto: string) => {
    setNotice({ tipo, texto })
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

  if (carregando) return <div className="boot">iniciando projectus<span className="cursor" /></div>
  if (!workspace)
    return (
      <div className="boot boot--error">
        <p>ERR / {erro ?? 'backend local indisponível'}</p>
        <button className="btn btn--quiet" type="button" onClick={() => void refresh()}>
          tentar novamente
        </button>
      </div>
    )
  if (workspace.capacidades?.api_version !== REQUIRED_API_VERSION)
    return <ServerVersionRecovery version={workspace.capacidades?.api_version} onRecovered={refresh} />

  const projectCard = workspace.board.projetos.find((project) => project.id === openProject)
  const setBoard = (board: Board) => setWorkspace({ ...workspace, board })
  const setIdeas = (ideias: Ideas) => setWorkspace({ ...workspace, ideias })
  const setConfig = (config: Config) => setWorkspace({ ...workspace, config })

  const navigate = (next: Screen) => {
    setScreen(next)
    setOpenProject(null)
  }

  const dataRootLabel = workspace.capacidades?.data_root_label || undefined

  return (
    <Shell
      screen={screen}
      projectTitle={projectCard?.titulo}
      config={workspace.config}
      dataRootLabel={dataRootLabel}
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
      {screen === 'backup' && <BackupView config={workspace.config} dataRootLabel={dataRootLabel} onMessage={message} />}
      {screen === 'arquivo' && (
        <ArchiveView board={workspace.board} ideas={workspace.ideias} onRefresh={refresh} onMessage={message} />
      )}
      {screen === 'config' && <SettingsView config={workspace.config} onConfig={setConfig} onMessage={message} />}
      <Notice notice={notice} />
    </Shell>
  )
}
