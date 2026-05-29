import type { ArchivedItem, Config, DocumentResponse, IdeaCard, Project, ProjectCard, TaskCard } from '../../lib/types'
import { localizeColumnTitle, type TFn } from '../../i18n'
import type { GlobalSearchEntry, SearchScreen } from './types'
import { SCREEN_COLORS } from './searchConfig'
import { mapTags, normalizeSearchText } from './searchUtils'

export function projectEntry(
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

export function taskEntry(task: TaskCard, project: Project, t: TFn): GlobalSearchEntry {
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

export function ideaEntry(idea: IdeaCard, t: TFn): GlobalSearchEntry {
  return {
    id: `idea:${idea.id}`,
    kind: 'idea',
    title: idea.titulo,
    location: t('search.location.ideas'),
    color: idea.cor,
    updatedAt: idea.atualizado_em,
    searchText: normalizeSearchText([idea.titulo, idea.pasta, t('search.kind.idea'), t('search.location.ideas')]),
    scopeText: normalizeSearchText([t('search.kind.idea'), t('search.location.ideas'), idea.titulo, idea.pasta]),
    action: { type: 'idea', ideaId: idea.id },
  }
}

export function archiveEntry(item: ArchivedItem, t: TFn): GlobalSearchEntry {
  const kindLabel = t(`archive_view.entity_label.${item.entidade === 'desconhecido' ? 'item' : item.entidade}`)
  const location = item.projeto_titulo
    ? t('search.location.archived_project', { titulo: item.projeto_titulo })
    : t('search.location.archive')
  return {
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
  }
}

export function screenEntries(t: TFn): GlobalSearchEntry[] {
  const screens: Array<{ screen: SearchScreen; summary: string }> = [
    { screen: 'projetos', summary: t('search.screen_summary.projects') },
    { screen: 'ideias', summary: t('search.screen_summary.ideas') },
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
