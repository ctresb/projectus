import type {
  Board,
  BackupCredentialStatus,
  Bootstrap,
  Config,
  DaemonStatus,
  DocumentResponse,
  IdeaCard,
  Ideas,
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
const base = import.meta.env.VITE_API_BASE ?? (isHttpPage ? '' : 'http://127.0.0.1:4387')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
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
  project: (id: string) => request<DocumentResponse<Project>>(`/projects/${id}`),
  createProject: (input: { titulo: string; github_url: string; markdown: string; cor: string; tags: string[] }) =>
    request<DocumentResponse<Project>>('/projects', { method: 'POST', body: JSON.stringify(input) }),
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
  deleteProject: (id: string, revision: number) =>
    request<Board>(`/projects/${id}?revision=${revision}`, { method: 'DELETE' }),
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
  deleteTask: (projectId: string, taskId: string, revision: number) =>
    request<Project>(`/projects/${projectId}/tasks/${taskId}?revision=${revision}`, { method: 'DELETE' }),
  moveTask: (projectId: string, input: { revision: number; id: string; status: string; indice: number }) =>
    request<Project>(`/projects/${projectId}/tasks/move`, { method: 'POST', body: JSON.stringify(input) }),
  idea: (id: string) => request<DocumentResponse<IdeaCard>>(`/ideas/${id}`),
  createIdea: (input: { titulo: string; markdown: string }) =>
    request<DocumentResponse<IdeaCard>>('/ideas', { method: 'POST', body: JSON.stringify(input) }),
  updateIdea: (id: string, input: { revision: number; titulo: string; markdown: string; cor: string }) =>
    request<DocumentResponse<IdeaCard>>(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteIdea: (id: string, revision: number) =>
    request<Ideas>(`/ideas/${id}?revision=${revision}`, { method: 'DELETE' }),
  ideas: () => request<Ideas>('/ideas'),
  uploadImage: async (path: string, image: File) => {
    const data = new FormData()
    data.append('imagem', image)
    const result = await request<{ url: string }>(path, { method: 'POST', body: data })
    return `${base}${result.url}`
  },
  saveCredentials: (input: { access_key_id: string; secret_access_key: string }) =>
    request<{ mensagem: string }>('/backups/credenciais', { method: 'POST', body: JSON.stringify(input) }),
  credentialStatus: () => request<BackupCredentialStatus>('/backups/credenciais'),
  snapshots: () => request<RemoteHistory>('/backups'),
  saveSnapshot: () => request('/backups/save', { method: 'POST' }),
  restoreSnapshot: (id: string) => request(`/backups/${id}/restore`, { method: 'POST' }),
  daemonStatus: () => request<DaemonStatus>('/daemon/status'),
  installDaemon: () => request<DaemonStatus>('/daemon/instalar', { method: 'POST' }),
  events: (onChange: () => void) => {
    const source = new EventSource(`${base}/api/events`)
    source.addEventListener('mudanca', onChange)
    return () => source.close()
  },
}
