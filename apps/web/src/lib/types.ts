export type Column = { id: string; titulo: string; cor: string }
export type Tag = { id: string; titulo: string; cor: string }
export type ColorChoice = { id: string; titulo: string; valor: string }
export type R2Config = {
  endpoint: string
  bucket: string
  region: string
  configurado: boolean
  ultimo_snapshot_em: string | null
}
export type Config = {
  schema_version: number
  revision: number
  porta: number
  colunas: Column[]
  tags: Tag[]
  cores: ColorChoice[]
  r2: R2Config
}
export type ProjectCard = {
  id: string
  pasta: string
  titulo: string
  github_url: string
  status: string
  cor: string
  tags: string[]
  criado_em: string
  atualizado_em: string
}
export type Board = { revision: number; projetos: ProjectCard[] }
export type TaskCard = {
  id: string
  pasta: string
  titulo: string
  status: string
  cor: string
  tags: string[]
  criado_em: string
  atualizado_em: string
}
export type Project = {
  revision: number
  id: string
  pasta: string
  titulo: string
  github_url: string
  colunas: Column[]
  tags_disponiveis: Tag[]
  tarefas: TaskCard[]
  criado_em: string
  atualizado_em: string
}
export type IdeaCard = {
  id: string
  pasta: string
  titulo: string
  cor: string
  criado_em: string
  atualizado_em: string
}
export type Ideas = { revision: number; notas: IdeaCard[] }
export type Bootstrap = { config: Config; board: Board; ideias: Ideas }
export type DocumentResponse<T> = { dados: T; markdown: string }
export type Snapshot = {
  id: string
  timestamp: string
  origem: 'manual' | 'automatico'
  arquivos: number
  bytes: number
}
export type RemoteHistory = { snapshots: Snapshot[] }
export type BackupCredentialStatus = {
  fixadas: boolean
  access_key_id_mascarada: string | null
}
export type DaemonStatus = {
  suportado: boolean
  instalado: boolean
  instalacao_disponivel: boolean
  plist: string | null
  executavel: string
}
export type EntityCard = ProjectCard | TaskCard
