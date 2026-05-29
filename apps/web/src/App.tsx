import { useCallback, useEffect, useRef, useState } from 'react'
import { Notice, type NoticeValue } from './components/Notice'
import type { Board, Config } from './lib/types'
import { useWorkspace } from './hooks/useWorkspace'
import { BackupView } from './features/backup/BackupView'
import { ArchiveView } from './features/archive/ArchiveView'
import { ProjectDetail } from './features/boards/ProjectDetail'
import { ProjectsView } from './features/boards/ProjectsView'
import { SettingsView } from './features/settings/SettingsView'
import { Shell, type Screen } from './features/shell/Shell'
import { REQUIRED_API_VERSION, ServerVersionRecovery } from './features/shell/ServerVersionRecovery'
import { I18nProvider } from './i18n'
import { Button, ErrorState, LoadingState } from './components/ui'
import { GlobalSearchController, type SearchNavigationTarget } from './features/search'
import { PluginHost } from './plugins/runtime/PluginHost'
import { NATIVE_SHORTCUT_KEYS } from './plugins/runtime/ShortcutManager'
import { useRegistry } from './plugins/registry/useRegistry'
import { PluginManagerView } from './plugins/manager/PluginManagerView'

type SearchFocus = SearchNavigationTarget & { token: number }

/// The TRUE native screens the host routes itself. These are the ONLY screen ids
/// the plugin host treats as its native reserved surface; a plugin screen id
/// (e.g. a builtin's `notes`) must never appear here, or the detector would
/// falsely flag the plugin as duplicating a native screen. Used both as the
/// conflict-detection baseline (passed to `<PluginHost native>`) and as the
/// switch guard in `AppShell` so the two never drift apart.
const NATIVE_SCREEN_IDS = ['projetos', 'arquivo', 'backup', 'config', 'plugins'] as const
const NATIVE_SCREENS = new Set<Screen>(NATIVE_SCREEN_IDS)

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

    if (target.type === 'archive') {
      setScreen('arquivo')
      setOpenProject(null)
      return
    }

    // Generic plugin-screen navigation: a search hit owned by a plugin carries
    // the screen id to open and an optional focus the plugin screen resolves
    // through its `navigationRequest`. Core never names the plugin.
    if (target.type === 'plugin') {
      setScreen(target.screen)
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

  return (
    <PluginHost
      native={{
        // ONLY true native screens — never a plugin screen id like `notes`, so a
        // builtin's own screen contribution is not mistaken for shadowing a
        // native route. `mod+k`/`mod+n` are the host's reserved accelerators.
        screenIds: NATIVE_SCREEN_IDS,
        shortcutKeys: NATIVE_SHORTCUT_KEYS,
      }}
    >
      <I18nProvider locale={workspace.config.idioma}>
        <AppShell
          workspace={workspace}
          setWorkspace={setWorkspace}
          screen={screen}
          openProject={openProject}
          setOpenProject={setOpenProject}
          searchFocus={searchFocus}
          setSearchFocus={setSearchFocus}
          notice={notice}
          message={message}
          navigate={navigate}
          navigateFromSearch={navigateFromSearch}
          refresh={refresh}
        />
      </I18nProvider>
    </PluginHost>
  )
}

/// The mounted app surface, split out so it can call `useRegistry` (which must
/// run inside `<PluginHost>`) to read the plugin-contributed screens and to
/// re-render the screen switch live on plugin enable/disable. Core stays
/// plugin-agnostic: native screens are switched explicitly; everything else is
/// resolved generically through `registry.screens()`.
function AppShell({
  workspace,
  setWorkspace,
  screen,
  openProject,
  setOpenProject,
  searchFocus,
  setSearchFocus,
  notice,
  message,
  navigate,
  navigateFromSearch,
  refresh,
}: {
  workspace: NonNullable<ReturnType<typeof useWorkspace>['workspace']>
  setWorkspace: ReturnType<typeof useWorkspace>['setWorkspace']
  screen: Screen
  openProject: string | null
  setOpenProject: (id: string | null) => void
  searchFocus: SearchFocus | null
  setSearchFocus: (focus: SearchFocus | null) => void
  notice: NoticeValue
  message: (tipo: 'ok' | 'erro' | 'info', texto: string) => void
  navigate: (next: Screen) => void
  navigateFromSearch: (target: SearchNavigationTarget) => void
  refresh: ReturnType<typeof useWorkspace>['refresh']
}) {
  // Subscribe to the registry so the screen switch re-renders whenever a plugin
  // is enabled/disabled (its screen contribution appears/disappears) — no restart.
  const registry = useRegistry()

  const projectCard = workspace.board.projetos.find((project) => project.id === openProject)
  const setBoard = (board: Board) => setWorkspace({ ...workspace, board })
  const setConfig = (config: Config) => setWorkspace({ ...workspace, config })

  // A native screen is rendered by the switch below; anything else falls through
  // to a plugin-contributed screen resolved from the registry by id. The native
  // set is the module-level `NATIVE_SCREENS`, shared with the host baseline.
  const pluginScreen = NATIVE_SCREENS.has(screen)
    ? undefined
    : registry.screens.find((entry) => entry.id === screen)

  return (
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
      {screen === 'plugins' && <PluginManagerView onMessage={message} />}
      {pluginScreen?.render({
        navigationRequest: searchFocus?.type === 'plugin' && searchFocus.screen === screen ? searchFocus : null,
        onMessage: (text) => message('info', text),
      })}
      <GlobalSearchController workspace={workspace} onNavigate={navigateFromSearch} />
      <Notice notice={notice} />
    </Shell>
  )
}
