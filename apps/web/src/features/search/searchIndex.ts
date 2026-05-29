import type { ArchiveIndex, Bootstrap, Config, DocumentResponse, Project, ProjectCard, Tag, TaskCard } from '../../lib/types'
import { localizeColumnTitle, type TFn } from '../../i18n'
import type {
  GlobalSearchEntry,
  GlobalSearchKind,
  GlobalSearchTag,
  SearchProvider,
  SearchProviderContext,
  SearchScopeToken,
  SearchScreen,
} from './types'

type BuildSearchEntriesInput = {
  workspace: Bootstrap
  projectDocuments?: Array<DocumentResponse<Project>>
  archive?: ArchiveIndex | null
  /// Plugin-contributed search providers, typically `registry.searchProviders()`.
  /// Core stays plugin-agnostic: it merges their entries, scope aliases, and
  /// colors without naming any individual plugin.
  searchProviders?: readonly SearchProvider[]
  t: TFn
}

type SearchScopeFilter =
  | { type: 'kinds'; kinds: GlobalSearchKind[] }
  | { type: 'project'; projectId: string }

const SCREEN_COLORS: Record<SearchScreen, string> = {
  projetos: 'var(--accent)',
  arquivo: '#B8B3A4',
  backup: '#61E141',
  config: '#FF8A48',
}

const KIND_PRIORITY: Record<GlobalSearchKind, number> = {
  project: 6,
  task: 5,
  plugin: 4,
  archive: 2,
  screen: 1,
}

/// Native, plugin-agnostic kind colors. Plugin providers contribute additional
/// colors (e.g. for the generic `plugin` kind) which are merged in at build time.
const BASE_SCOPE_KIND_COLORS: Record<GlobalSearchKind, string> = {
  project: 'var(--accent)',
  task: '#55B9F7',
  plugin: 'var(--accent)',
  archive: '#B8B3A4',
  screen: 'var(--accent)',
}

/// Native, plugin-agnostic scope aliases. Domain-specific aliases (`note`,
/// `notas`, …) are no longer hardcoded here — providers supply them, so when a
/// plugin is disabled its aliases simply disappear.
const BASE_SCOPE_ALIASES: Record<string, GlobalSearchKind[]> = {
  projeto: ['project'],
  projetos: ['project'],
  project: ['project'],
  projects: ['project'],
  tarefa: ['task'],
  tarefas: ['task'],
  task: ['task'],
  tasks: ['task'],
  arquivo: ['archive'],
  arquivados: ['archive'],
  archive: ['archive'],
  archived: ['archive'],
  atalho: ['screen'],
  atalhos: ['screen'],
  tela: ['screen'],
  telas: ['screen'],
  screen: ['screen'],
  screens: ['screen'],
  backup: ['screen'],
  backups: ['screen'],
  snapshot: ['screen'],
  snapshots: ['screen'],
  ajuste: ['screen'],
  ajustes: ['screen'],
  setting: ['screen'],
  settings: ['screen'],
  config: ['screen'],
}

/// Live scope maps: the native base merged with the current build's
/// provider contributions. Refreshed by `buildSearchEntries` so the scope-query
/// helpers (`getScopedSearchQuery`, `getImplicitScopeQuery`, …) — which only
/// receive `entries` — see the same aliases/colors the entries were built with.
let SCOPE_ALIASES: Record<string, GlobalSearchKind[]> = { ...BASE_SCOPE_ALIASES }
let SCOPE_KIND_COLORS: Record<GlobalSearchKind, string> = { ...BASE_SCOPE_KIND_COLORS }

function applyProviderScopes(providers: readonly SearchProvider[]) {
  const aliases: Record<string, GlobalSearchKind[]> = { ...BASE_SCOPE_ALIASES }
  const colors: Record<GlobalSearchKind, string> = { ...BASE_SCOPE_KIND_COLORS }
  for (const provider of providers) {
    if (provider.scopeAliases) {
      for (const [alias, kinds] of Object.entries(provider.scopeAliases)) {
        aliases[normalizeSingleValue(alias)] = kinds
      }
    }
    if (provider.colors) {
      for (const [kind, color] of Object.entries(provider.colors) as Array<[GlobalSearchKind, string]>) {
        colors[kind] = color
      }
    }
  }
  SCOPE_ALIASES = aliases
  SCOPE_KIND_COLORS = colors
}

export function buildSearchEntries({
  workspace,
  projectDocuments = [],
  archive,
  searchProviders = [],
  t,
}: BuildSearchEntriesInput) {
  applyProviderScopes(searchProviders)

  const entries: GlobalSearchEntry[] = []
  const projectDocumentById = new Map(projectDocuments.map((document) => [document.dados.id, document]))

  for (const project of workspace.board.projetos) {
    entries.push(projectEntry(project, projectDocumentById.get(project.id), workspace.config, t))
  }

  for (const document of projectDocuments) {
    const project = document.dados
    for (const task of project.tarefas) {
      entries.push(taskEntry(task, project, t))
    }
  }

  const providerContext: SearchProviderContext = { workspace, t }
  for (const provider of searchProviders) {
    entries.push(...provider.entries(providerContext))
  }

  for (const item of archive?.itens ?? []) {
    const kindLabel = t(`archive_view.entity_label.${item.entidade === 'desconhecido' ? 'item' : item.entidade}`)
    const location = item.projeto_titulo
      ? t('search.location.archived_project', { titulo: item.projeto_titulo })
      : t('search.location.archive')
    entries.push({
      id: `archive:${item.id}`,
      kind: 'archive',
      title: item.titulo,
      location,
      description: kindLabel,
      color: 'var(--fg3)',
      updatedAt: item.arquivado_em,
      searchText: normalizeSearchText([
        item.titulo,
        item.pasta,
        item.projeto_titulo,
        kindLabel,
        t('search.kind.archive'),
        t('search.location.archive'),
      ]),
      scopeText: normalizeSearchText([t('search.kind.archive'), t('search.location.archive'), item.projeto_titulo]),
      projectScopeId: item.projeto_id ?? (item.entidade === 'projeto' ? item.entidade_id : undefined),
      action: { type: 'archive', archiveId: item.id },
    })
  }

  entries.push(...screenEntries(t))
  return entries
}

export function searchEntries(entries: GlobalSearchEntry[], query: string, limit = 12) {
  const scoped = getScopedSearchQuery(entries, query)
  const implicitScope = scoped ? null : getImplicitScopeQuery(query)
  const candidates = scoped
    ? applyScopeFilters(entries, scoped.filters)
    : implicitScope
      ? applyScopeFilters(entries, implicitScope.filters)
      : entries
  const normalizedQuery = normalizeSingleValue(scoped ? scoped.query : implicitScope ? implicitScope.query : query)
  if (!normalizedQuery) {
    return [...candidates]
      .sort((left, right) => {
        const leftDynamic = left.kind === 'screen' ? 0 : 1
        const rightDynamic = right.kind === 'screen' ? 0 : 1
        if (leftDynamic !== rightDynamic) return rightDynamic - leftDynamic
        return dateScore(right.updatedAt) - dateScore(left.updatedAt)
      })
      .slice(0, limit)
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  return candidates
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || dateScore(right.entry.updatedAt) - dateScore(left.entry.updatedAt))
    .map(({ entry }) => entry)
    .slice(0, limit)
}

export type ScopedSearchQuery = {
  filters: SearchScopeFilter[]
  tokens: SearchScopeToken[]
  query: string
}

export function getScopedSearchQuery(entries: GlobalSearchEntry[], query: string): ScopedSearchQuery | null {
  const slash = query.indexOf('/')
  if (slash <= 0) return null

  const segments = query.split('/')
  const scopeSegments = segments.slice(0, -1)
  let querySegments = segments.slice(-1)
  const tokens: SearchScopeToken[] = []
  let filters: SearchScopeFilter[] = []

  for (let index = 0; index < scopeSegments.length; index += 1) {
    const rawScope = scopeSegments[index].trim()
    const scope = normalizeSingleValue(rawScope)
    if (!scope) break

    const kinds = SCOPE_ALIASES[scope]
    if (kinds) {
      filters = [...filters, { type: 'kinds', kinds }]
      tokens.push({
        raw: rawScope,
        label: rawScope,
        color: SCOPE_KIND_COLORS[kinds[0]],
      })
      continue
    }

    const scopeEntry = bestScopeEntry(applyScopeFilters(entries, filters), scope)
    if (!scopeEntry || scopeEntry.action.type !== 'project') {
      querySegments = [...scopeSegments.slice(index), ...segments.slice(-1)]
      break
    }

    filters = [{ type: 'project', projectId: scopeEntry.action.projectId }]
    tokens.push({
      raw: rawScope,
      label: scopeEntry.title,
      color: scopeEntry.color,
    })
  }

  if (tokens.length === 0) return null

  return {
    filters,
    tokens,
    query: querySegments.join('/'),
  }
}

function getImplicitScopeQuery(query: string): Pick<ScopedSearchQuery, 'filters' | 'query'> | null {
  const scope = normalizeSingleValue(query)
  const kinds = SCOPE_ALIASES[scope]
  if (!kinds) return null
  return {
    filters: [{ type: 'kinds', kinds }],
    query: '',
  }
}

export function completeQueryWithScope(entries: GlobalSearchEntry[], query: string, entry: GlobalSearchEntry) {
  const completedTypedScope = completeTypedScopeAlias(query)
  if (completedTypedScope) return completedTypedScope

  if (!canUseEntryAsScope(entry)) return null
  const scoped = getScopedSearchQuery(entries, query)
  const currentScopes = scoped?.tokens.map((token) => token.raw) ?? []
  return `${[...currentScopes, entry.title].join('/')}/`
}

export function canUseEntryAsScope(entry: GlobalSearchEntry) {
  return entry.kind === 'project' && entry.action.type === 'project'
}

function applyScopeFilters(entries: GlobalSearchEntry[], filters: SearchScopeFilter[]) {
  return filters.reduce((current, filter) => {
    if (filter.type === 'kinds') {
      return current.filter((entry) => filter.kinds.includes(entry.kind))
    }
    return current.filter((entry) => entry.projectScopeId === filter.projectId)
  }, entries)
}

function bestScopeEntry(entries: GlobalSearchEntry[], scope: string) {
  const matches = entries.filter(
    (entry) => entry.kind === 'project' && entry.action.type === 'project' && entry.scopeText.includes(scope),
  )
  return (
    matches.find((entry) => normalizeSingleValue(entry.title) === scope) ??
    matches.find((entry) => normalizeSingleValue(entry.title).includes(scope)) ??
    matches[0] ??
    null
  )
}

function completeTypedScopeAlias(query: string) {
  const segments = query.split('/')
  const rawScope = segments.at(-1)?.trim() ?? ''
  const scope = normalizeSingleValue(rawScope)
  if (!scope || !SCOPE_ALIASES[scope]) return null

  const prefix = segments
    .slice(0, -1)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
  return `${prefix ? `${prefix}/` : ''}${rawScope}/`
}

export function normalizeSingleValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function projectEntry(
  project: ProjectCard,
  document: DocumentResponse<Project> | undefined,
  config: Config,
  t: TFn,
): GlobalSearchEntry {
  const status = config.colunas.find((column) => column.id === project.status)
  const statusLabel = status ? localizeColumnTitle(status.titulo, t) : project.status
  const tags = mapTags(project.tags, config.tags)
  return {
    id: `project:${project.id}`,
    kind: 'project',
    title: project.titulo,
    location: t('search.location.project_status', { status: statusLabel }),
    description: project.resumo,
    color: project.cor,
    tags,
    updatedAt: project.atualizado_em,
    searchText: normalizeSearchText([
      project.titulo,
      project.resumo,
      project.github_url,
      project.pasta,
      statusLabel,
      t('search.kind.project'),
      tags.map((tag) => tag.title).join(' '),
      document?.markdown,
    ]),
    scopeText: normalizeSearchText([project.titulo, project.pasta, project.github_url, t('search.kind.project')]),
    projectScopeId: project.id,
    action: { type: 'project', projectId: project.id },
  }
}

function taskEntry(task: TaskCard, project: Project, t: TFn): GlobalSearchEntry {
  const status = project.colunas.find((column) => column.id === task.status)
  const statusLabel = status ? localizeColumnTitle(status.titulo, t) : task.status
  const tags = mapTags(task.tags, project.tags_disponiveis)
  return {
    id: `task:${project.id}:${task.id}`,
    kind: 'task',
    title: task.titulo,
    location: t('search.location.task_status', { projeto: project.titulo, status: statusLabel }),
    description: task.resumo,
    color: task.cor,
    tags,
    updatedAt: task.atualizado_em,
    searchText: normalizeSearchText([
      task.titulo,
      task.resumo,
      task.pasta,
      project.titulo,
      statusLabel,
      t('search.kind.task'),
      tags.map((tag) => tag.title).join(' '),
    ]),
    scopeText: normalizeSearchText([project.titulo, project.pasta, project.github_url, t('search.kind.task')]),
    projectScopeId: project.id,
    action: { type: 'task', projectId: project.id, taskId: task.id },
  }
}

function screenEntries(t: TFn): GlobalSearchEntry[] {
  const screens: Array<{ screen: SearchScreen; summary: string }> = [
    { screen: 'projetos', summary: t('search.screen_summary.projects') },
    { screen: 'arquivo', summary: t('search.screen_summary.archive') },
    { screen: 'backup', summary: t('search.screen_summary.backup') },
    { screen: 'config', summary: t('search.screen_summary.settings') },
  ]
  return screens.map(({ screen, summary }) => {
    const title = t(`shell.nav.${screen}`)
    return {
      id: `screen:${screen}`,
      kind: 'screen',
      title,
      location: t('search.location.screen'),
      description: summary,
      color: SCREEN_COLORS[screen],
      searchText: normalizeSearchText([title, summary, t('search.kind.screen')]),
      scopeText: normalizeSearchText([title, summary, t('search.kind.screen')]),
      action: { type: 'screen', screen },
    }
  })
}

function mapTags(ids: string[], tags: Tag[]): GlobalSearchTag[] {
  return ids
    .map((id) => {
      const tag = tags.find((candidate) => candidate.id === id)
      return tag ? { id: tag.id, title: tag.titulo, color: tag.cor } : null
    })
    .filter((tag): tag is GlobalSearchTag => Boolean(tag))
}

function normalizeSearchText(values: Array<string | null | undefined>) {
  return normalizeSingleValue(values.filter(Boolean).join(' '))
}

function scoreEntry(entry: GlobalSearchEntry, terms: string[]) {
  if (!terms.every((term) => entry.searchText.includes(term))) return 0
  const title = normalizeSingleValue(entry.title)
  const location = normalizeSingleValue(entry.location)
  const description = normalizeSingleValue(entry.description ?? '')
  let score = KIND_PRIORITY[entry.kind]

  for (const term of terms) {
    if (title === term) score += 70
    else if (title.startsWith(term)) score += 48
    else if (title.includes(term)) score += 34
    else if (location.includes(term)) score += 18
    else if (description.includes(term)) score += 12
    else score += 6
  }

  return score
}

function dateScore(value: string | undefined) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}
