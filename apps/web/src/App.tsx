import { useCallback, useEffect, useRef, useState } from 'react'
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
import { I18nProvider } from './i18n'
import { Button, ErrorState, LoadingState } from './components/ui'
import { GlobalSearchController, type SearchNavigationTarget } from './features/search'

type SearchFocus = SearchNavigationTarget & { token: number }

export function App() {
  const { workspace, setWorkspace, erro, carregando, refresh } = useWorkspace()
  const [screen, setScreen] = useState<Screen>('projetos')
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeValue>(null)
  const [searchFocus, setSearchFocus] = useState<SearchFocus | null>(null)
  const searchToken = useRef(0)

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

  const navigate = useCallback((next: Screen) => {
    setSearchFocus(null)
    setScreen(next)
    setOpenProject(null)
  }, [])

  const navigateFromSearch = useCallback((target: SearchNavigationTarget) => {
    searchToken.current += 1
    setSearchFocus({ ...target, token: searchToken.current })

    if (target.type === 'project') {
      setScreen('projetos')
      setOpenProject(target.projectId)
      return
    }

    if (target.type === 'task') {
      setScreen('projetos')
      setOpenProject(target.projectId)
      return
    }

    if (target.type === 'idea') {
      setScreen('ideias')
      setOpenProject(null)
      return
    }

    if (target.type === 'archive') {
      setScreen('arquivo')
      setOpenProject(null)
      return
    }

    navigate(target.screen)
  }, [navigate])

  if (carregando) return <LoadingState className="boot">iniciando projectus<span className="cursor" /></LoadingState>
  if (!workspace)
    return (
      <ErrorState className="boot boot--error">
        <p>ERR / {erro ?? 'backend local indisponível'}</p>
        <Button type="button" onClick={() => void refresh()}>
          tentar novamente
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
            navigationRequest={
              searchFocus?.type === 'task' && searchFocus.projectId === projectCard.id
                ? { type: 'task', taskId: searchFocus.taskId, token: searchFocus.token }
                : searchFocus?.type === 'project' && searchFocus.projectId === projectCard.id
                  ? { type: 'project', token: searchFocus.token }
                  : null
            }
            onBack={() => {
              setSearchFocus(null)
              setOpenProject(null)
            }}
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
        <IdeasView
          config={workspace.config}
          ideas={workspace.ideias}
          navigationRequest={
            searchFocus?.type === 'idea' ? { id: searchFocus.ideaId, token: searchFocus.token } : null
          }
          onIdeas={setIdeas}
          onMessage={message}
        />
      )}
      {screen === 'backup' && <BackupView config={workspace.config} onMessage={message} />}
      {screen === 'arquivo' && (
        <ArchiveView
          focusRequest={
            searchFocus?.type === 'archive' ? { id: searchFocus.archiveId, token: searchFocus.token } : null
          }
          onRefresh={refresh}
          onMessage={message}
        />
      )}
      {screen === 'config' && <SettingsView config={workspace.config} onConfig={setConfig} onMessage={message} />}
      <GlobalSearchController workspace={workspace} onNavigate={navigateFromSearch} />
      <Notice notice={notice} />
    </Shell>
    </I18nProvider>
  )
}
