import type { GlobalSearchKind, SearchScreen } from './types'

export const SCREEN_COLORS: Record<SearchScreen, string> = {
  projetos: 'var(--accent)',
  ideias: '#FAD344',
  arquivo: '#B8B3A4',
  backup: '#61E141',
  config: '#FF8A48',
}

export const KIND_PRIORITY: Record<GlobalSearchKind, number> = {
  project: 6,
  task: 5,
  idea: 4,
  archive: 2,
  screen: 1,
}

export const SCOPE_KIND_COLORS: Record<GlobalSearchKind, string> = {
  project: 'var(--accent)',
  task: '#55B9F7',
  idea: '#FAD344',
  archive: '#B8B3A4',
  screen: 'var(--accent)',
}

export const SCOPE_ALIASES: Record<string, GlobalSearchKind[]> = {
  projeto: ['project'],
  projetos: ['project'],
  project: ['project'],
  projects: ['project'],
  tarefa: ['task'],
  tarefas: ['task'],
  task: ['task'],
  tasks: ['task'],
  nota: ['idea'],
  notas: ['idea'],
  note: ['idea'],
  notes: ['idea'],
  ideia: ['idea'],
  ideias: ['idea'],
  idea: ['idea'],
  ideas: ['idea'],
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
