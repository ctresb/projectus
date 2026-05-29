export type SearchScreen = 'projetos' | 'ideias' | 'arquivo' | 'backup' | 'config'

export type GlobalSearchKind = 'project' | 'task' | 'idea' | 'archive' | 'screen'

export type SearchNavigationTarget =
  | { type: 'project'; projectId: string }
  | { type: 'task'; projectId: string; taskId: string }
  | { type: 'idea'; ideaId: string }
  | { type: 'archive'; archiveId: string }
  | { type: 'screen'; screen: SearchScreen }

export type GlobalSearchTag = {
  id: string
  title: string
  color: string
}

export type GlobalSearchEntry = {
  id: string
  kind: GlobalSearchKind
  title: string
  location: string
  description?: string
  color?: string
  tags?: GlobalSearchTag[]
  updatedAt?: string
  searchText: string
  scopeText: string
  projectScopeId?: string
  action: SearchNavigationTarget
}

export type SearchScopeToken = {
  raw: string
  label: string
  color?: string
}
