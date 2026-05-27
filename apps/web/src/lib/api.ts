import type {
  Board,
  ArchiveIndex,
  BackupCredentialStatus,
  Bootstrap,
  Config,
  DaemonStatus,
  DocumentResponse,
  IdeaCard,
  Ideas,
  LanStatus,
  LiveEvent,
  Project,
  RemoteHistory,
} from './types'

export class ApiFailure extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

const isHttpPage = window.location.protocol === 'http:' || window.location.protocol === 'https:'
const defaultBase = import.meta.env.VITE_API_BASE ?? (isHttpPage ? window.location.origin : 'http://127.0.0.1:4387')

export type ConnectionConfig = {
  server_url: string
  api_token: string
}

export type DiscoveredServer = {
  produto: string
  versao: string
  server_url: string
  lan_exposto: boolean
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
      }
    }
  }
}

let connection: ConnectionConfig = {
  server_url: normalizeServerUrl(defaultBase),
  api_token: '',
}

function invoke<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) return null
  return window.__TAURI__.core.invoke<T>(command, args)
}

export function normalizeServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`
}

export function setApiConnection(next: ConnectionConfig) {
  connection = {
    server_url: normalizeServerUrl(next.server_url),
    api_token: next.api_token.trim(),
  }
}

export function getApiConnection() {
  return connection
}

export async function loadSavedConnection() {
  const saved = await invoke<ConnectionConfig | null>('load_connection')
  if (saved) {
    setApiConnection(saved)
    return getApiConnection()
  }
  const local = window.localStorage.getItem('projectus.connection')
  if (!local) return null
  const parsed = JSON.parse(local) as ConnectionConfig
  setApiConnection(parsed)
  return getApiConnection()
}

export async function saveConnection(next: ConnectionConfig) {
  const normalized = {
    server_url: normalizeServerUrl(next.server_url),
    api_token: next.api_token.trim(),
  }
  const saved = await invoke<ConnectionConfig>('save_connection', { input: normalized })
  if (saved) {
    setApiConnection(saved)
    return getApiConnection()
  }
  window.localStorage.setItem('projectus.connection', JSON.stringify(normalized))
  setApiConnection(normalized)
  return getApiConnection()
}

export async function clearConnection() {
  await invoke('clear_connection')
  window.localStorage.removeItem('projectus.connection')
  setApiConnection({ server_url: normalizeServerUrl(defaultBase), api_token: '' })
}

export async function discoverServers() {
  const discovered = await invoke<DiscoveredServer[]>('discover_servers')
  return discovered ?? []
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(connection.api_token ? { Authorization: `Bearer ${connection.api_token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const response = await fetch(`${connection.server_url}/api${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ mensagem: 'erro inesperado' }))) as {
      mensagem: string
    }
    throw new ApiFailure(body.mensagem, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  bootstrap: () => request<Bootstrap>('/bootstrap'),
  updateConfig: (config: Config) => request<Config>('/config', { method: 'PUT', body: JSON.stringify(config) }),
  archive: () => request<ArchiveIndex>('/archive'),
  project: (id: string) => request<DocumentResponse<Project>>(`/projects/${id}`),
  createProject: (input: {
    titulo: string
    github_url: string
    markdown: string
    cor: string
    tags: string[]
    novas_tags?: import('./types').Tag[]
  }) => request<DocumentResponse<Project>>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (
    id: string,
    input: {
      revision: number
      titulo: string
      github_url: string
      markdown: string
      cor: string
      tags: string[]
      colunas?: import('./types').Column[]
      tags_disponiveis?: import('./types').Tag[]
    },
  ) => request<DocumentResponse<Project>>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  archiveProject: (id: string, revision: number) =>
    request<ArchiveIndex>(`/projects/${id}/archive`, { method: 'POST', body: JSON.stringify({ revision }) }),
  moveProject: (input: { revision: number; id: string; status: string; indice: number }) =>
    request<Board>('/projects/move', { method: 'POST', body: JSON.stringify(input) }),
  createTask: (
    projectId: string,
    input: {
      revision: number
      titulo: string
      markdown: string
      cor: string
      tags: string[]
      novas_tags: import('./types').Tag[]
    },
  ) =>
    request<DocumentResponse<Project>>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(input) }),
  taskMarkdown: (projectId: string, taskId: string) =>
    request<{ markdown: string }>(`/projects/${projectId}/tasks/${taskId}`),
  updateTask: (
    projectId: string,
    taskId: string,
    input: { revision: number; titulo: string; markdown: string; cor: string; tags: string[] },
  ) => request<Project>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(input) }),
  archiveTask: (projectId: string, taskId: string, revision: number) =>
    request<ArchiveIndex>(`/projects/${projectId}/tasks/${taskId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ revision }),
    }),
  moveTask: (projectId: string, input: { revision: number; id: string; status: string; indice: number }) =>
    request<Project>(`/projects/${projectId}/tasks/move`, { method: 'POST', body: JSON.stringify(input) }),
  idea: (id: string) => request<DocumentResponse<IdeaCard>>(`/ideas/${id}`),
  createIdea: (input: { titulo: string; markdown: string }) =>
    request<DocumentResponse<IdeaCard>>('/ideas', { method: 'POST', body: JSON.stringify(input) }),
  updateIdea: (id: string, input: { revision: number; titulo: string; markdown: string; cor: string }) =>
    request<DocumentResponse<IdeaCard>>(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  archiveIdea: (id: string, revision: number) =>
    request<ArchiveIndex>(`/ideas/${id}/archive`, { method: 'POST', body: JSON.stringify({ revision }) }),
  restoreArchived: (id: string, revision: number, destinoRevision: number) =>
    request<ArchiveIndex>(`/archive/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ revision, destino_revision: destinoRevision }),
    }),
  deleteArchived: (id: string, revision: number) =>
    request<ArchiveIndex>(`/archive/${id}?revision=${revision}`, { method: 'DELETE' }),
  ideas: () => request<Ideas>('/ideas'),
  uploadImage: async (path: string, image: File) => {
    const data = new FormData()
    data.append('imagem', image)
    const result = await request<{ url: string }>(path, { method: 'POST', body: data })
    return `${connection.server_url}${result.url}`
  },
  saveCredentials: (input: { access_key_id: string; secret_access_key: string }) =>
    request<{ mensagem: string }>('/backups/credenciais', { method: 'POST', body: JSON.stringify(input) }),
  credentialStatus: () => request<BackupCredentialStatus>('/backups/credenciais'),
  snapshots: () => request<RemoteHistory>('/backups'),
  saveSnapshot: () => request('/backups/save', { method: 'POST' }),
  restoreSnapshot: (id: string) => request(`/backups/${id}/restore`, { method: 'POST' }),
  lanStatus: () => request<LanStatus>('/lan'),
  toggleLan: (ativo: boolean) => request<LanStatus>('/lan', { method: 'POST', body: JSON.stringify({ ativo }) }),
  daemonStatus: () => request<DaemonStatus>('/daemon/status'),
  installDaemon: () => request<DaemonStatus>('/daemon/instalar', { method: 'POST' }),
  restartDaemon: () => request<DaemonStatus>('/daemon/reiniciar', { method: 'POST' }),
  events: (onEvent: (event: LiveEvent) => void) => {
    if (!connection.api_token) return () => undefined
    const source = new EventSource(`${connection.server_url}/api/events?token=${encodeURIComponent(connection.api_token)}`)
    source.addEventListener('mudanca', (raw) => {
      try {
        onEvent(JSON.parse((raw as MessageEvent).data) as LiveEvent)
      } catch {
        /* malformed payload — skip */
      }
    })
    return () => source.close()
  },
  validateConnection: async (next: ConnectionConfig) => {
    const previous = getApiConnection()
    setApiConnection(next)
    try {
      return await request<{ ok: boolean; server_version: string; api_version: number }>('/health')
    } finally {
      setApiConnection(previous)
    }
  },
}
