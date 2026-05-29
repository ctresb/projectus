import type { ArchiveIndex, Bootstrap, DocumentResponse, Project } from '../../lib/types'
import type { TFn } from '../../i18n'
import type { GlobalSearchEntry, GlobalSearchKind, SearchScopeToken } from './types'
import { SCOPE_ALIASES, SCOPE_KIND_COLORS } from './searchConfig'
import { archiveEntry, ideaEntry, projectEntry, screenEntries, taskEntry } from './searchBuilders'
import { dateScore, normalizeSingleValue, scoreEntry } from './searchUtils'

// Re-export moved symbols that test files and importers reference from './searchIndex'.
export { normalizeSingleValue } from './searchUtils'

type BuildSearchEntriesInput = {
  workspace: Bootstrap
  projectDocuments?: Array<DocumentResponse<Project>>
  archive?: ArchiveIndex | null
  t: TFn
}

type SearchScopeFilter = { type: 'kinds'; kinds: GlobalSearchKind[] } | { type: 'project'; projectId: string }

export function buildSearchEntries({ workspace, projectDocuments = [], archive, t }: BuildSearchEntriesInput) {
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

  for (const idea of workspace.ideias.notas) {
    entries.push(ideaEntry(idea, t))
  }

  for (const item of archive?.itens ?? []) {
    entries.push(archiveEntry(item, t))
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
    .sort(
      (left, right) => right.score - left.score || dateScore(right.entry.updatedAt) - dateScore(left.entry.updatedAt),
    )
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
