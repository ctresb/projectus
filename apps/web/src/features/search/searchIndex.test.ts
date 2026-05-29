import { describe, expect, it } from 'vitest'
import type { Bootstrap, DocumentResponse, Project } from '../../lib/types'
import type { TFn } from '../../i18n'
import {
  buildSearchEntries,
  completeQueryWithScope,
  getScopedSearchQuery,
  normalizeSingleValue,
  searchEntries,
} from './searchIndex'
import type { SearchProvider } from './types'
import { scopeTokenStyle } from './scopeColors'
import { matchesShortcut } from './shortcuts'

const t: TFn = (key, vars) => {
  const values: Record<string, string> = {
    'search.kind.project': 'projeto',
    'search.kind.task': 'tarefa',
    'search.kind.plugin': 'nota',
    'search.kind.archive': 'arquivo',
    'search.kind.screen': 'atalho',
    'search.location.notes': 'notas',
    'search.location.archive': 'arquivo',
    'search.location.screen': 'tela',
    'search.location.project_status': `projetos / ${vars?.status ?? ''}`,
    'search.location.task_status': `${vars?.projeto ?? ''} / ${vars?.status ?? ''}`,
    'search.location.archived_project': `arquivo / ${vars?.titulo ?? ''}`,
    'search.screen_summary.projects': 'quadro principal',
    'search.screen_summary.notes': 'notas',
    'search.screen_summary.archive': 'arquivo',
    'search.screen_summary.backup': 'snapshots',
    'search.screen_summary.settings': 'ajustes',
    'shell.nav.projetos': 'projetos',
    'shell.nav.notas': 'notas',
    'shell.nav.arquivo': 'arquivo',
    'shell.nav.backup': 'snapshots',
    'shell.nav.config': 'ajustes',
    'archive_view.entity_label.projeto': 'projeto',
    'archive_view.entity_label.tarefa': 'tarefa',
    'archive_view.entity_label.note': 'nota',
    'archive_view.entity_label.item': 'item',
  }
  return values[key] ?? key
}

const workspace: Bootstrap = {
  config: {
    schema_version: 1,
    revision: 1,
    porta: 4387,
    colunas: [{ id: 'doing', titulo: 'Fazendo', cor: '#55B9F7' }],
    tags: [{ id: 'core', titulo: 'Core', cor: '#FAD344' }],
    cores: [],
    r2: { endpoint: '', bucket: '', region: 'auto', configurado: false, ultimo_snapshot_em: null },
    cor_principal: '#55B9F7',
    lan_exposto: false,
    idioma: 'pt-BR',
  },
  board: {
    revision: 1,
    projetos: [
      {
        id: 'project-1',
        pasta: 'api-project',
        titulo: 'API Local',
        resumo: 'Backend do PROJECTUS',
        github_url: 'https://github.com/acme/projectus',
        status: 'doing',
        cor: '#45E0B9',
        tags: ['core'],
        criado_em: '2026-05-28T00:00:00Z',
        atualizado_em: '2026-05-29T00:00:00Z',
      },
    ],
  },
  notes: {
    revision: 1,
    notas: [
      {
        id: 'note-1',
        pasta: 'nota-busca',
        titulo: 'Busca rápida',
        cor: '#FAD344',
        criado_em: '2026-05-28T00:00:00Z',
        atualizado_em: '2026-05-29T01:00:00Z',
      },
    ],
  },
}

/// Notes are no longer indexed inline by the core builder — they arrive through a
/// plugin `SearchProvider` (`registry.searchProviders()`). This stand-in mirrors
/// the builtin Notes contribution so the core builder can be exercised the way it
/// runs in production (merging provider entries, scope aliases, and colors)
/// without the core test naming or importing any plugin.
const noteProvider: SearchProvider = {
  // Indexes the workspace handed in via the `SearchProviderContext`, not a module
  // global — mirroring the real Notes provider after the search decoupling: the
  // host builds entries from the current `{ workspace, t }`, so notes are indexed
  // whether or not the Notes screen ever mounted.
  entries: ({ workspace: ws, t: tt }) =>
    ws.notes.notas.map((note) => ({
      id: `note:${note.id}`,
      kind: 'plugin' as const,
      title: note.titulo,
      location: tt('search.location.notes'),
      color: note.cor,
      updatedAt: note.atualizado_em,
      searchText: normalizeSingleValue([note.titulo, note.pasta, tt('search.kind.plugin'), tt('search.location.notes')].join(' ')),
      scopeText: normalizeSingleValue([tt('search.kind.plugin'), tt('search.location.notes'), note.titulo, note.pasta].join(' ')),
      action: { type: 'plugin', pluginId: 'notes', screen: 'notes', focus: note.id },
    })),
  scopeAliases: {
    note: ['plugin'],
    notes: ['plugin'],
    nota: ['plugin'],
    notas: ['plugin'],
  },
  colors: { plugin: '#FAD344' },
}

const projectDocument: DocumentResponse<Project> = {
  markdown: '# API Local',
  dados: {
    revision: 2,
    id: 'project-1',
    pasta: 'api-project',
    titulo: 'API Local',
    github_url: 'https://github.com/acme/projectus',
    colunas: [{ id: 'doing', titulo: 'Fazendo', cor: '#55B9F7' }],
    tags_disponiveis: [{ id: 'core', titulo: 'Core', cor: '#FAD344' }],
    tarefas: [
      {
        id: 'task-1',
        pasta: 'task-command-k',
        titulo: 'Command K universal',
        resumo: 'Abrir busca de qualquer tela',
        status: 'doing',
        cor: '#61E141',
        tags: ['core'],
        criado_em: '2026-05-28T00:00:00Z',
        atualizado_em: '2026-05-29T02:00:00Z',
      },
    ],
    criado_em: '2026-05-28T00:00:00Z',
    atualizado_em: '2026-05-29T00:00:00Z',
  },
}

describe('global search index', () => {
  it('indexa projetos, tarefas e notas com o alvo de navegacao correto', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], searchProviders: [noteProvider], t })

    expect(entries.some((entry) => entry.id === 'project:project-1')).toBe(true)
    expect(entries.some((entry) => entry.id === 'note:note-1')).toBe(true)
    expect(searchEntries(entries, 'command k')[0].action).toEqual({
      type: 'task',
      projectId: 'project-1',
      taskId: 'task-1',
    })
  })

  it('normaliza acentos na busca', () => {
    expect(normalizeSingleValue('Ação Rápida')).toBe('acao rapida')
  })

  it('limita a busca por projeto quando usa prefixo nome-do-projeto/termo', () => {
    const otherProject: DocumentResponse<Project> = {
      markdown: '',
      dados: {
        ...projectDocument.dados,
        id: 'project-2',
        titulo: 'Outro CRM',
        pasta: 'outro-crm',
        tarefas: [
          {
            ...projectDocument.dados.tarefas[0],
            id: 'task-2',
            titulo: 'Command K duplicado',
          },
        ],
      },
    }
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument, otherProject], t })

    expect(searchEntries(entries, 'API Local/command k').map((entry) => entry.id)).toEqual(['task:project-1:task-1'])
  })

  it('retorna token visual com a cor do escopo encontrado', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })
    const scoped = getScopedSearchQuery(entries, 'api local/command')

    expect(scoped?.tokens).toMatchObject([{ label: 'API Local', color: '#45E0B9' }])
    expect(scoped?.query).toBe('command')
  })

  it('deriva fundo hsl escuro a partir da cor principal do escopo', () => {
    expect(scopeTokenStyle('#45E0B9')).toEqual({
      color: 'hsl(165 71% 57%)',
      backgroundColor: 'hsl(165 10% 24%)',
    })
  })

  it('aceita aliases em portugues e ingles para limitar por tipo', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], searchProviders: [noteProvider], t })

    expect(searchEntries(entries, 'tasks/command')[0].kind).toBe('task')
    expect(searchEntries(entries, 'tarefas/command')[0].kind).toBe('task')
    expect(searchEntries(entries, 'notas/busca')[0].kind).toBe('plugin')
    expect(searchEntries(entries, 'note/busca')[0].kind).toBe('plugin')
  })

  it('trata alias exato sem barra como escopo geral do tipo', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })

    expect(searchEntries(entries, 'projects').map((entry) => entry.kind)).toEqual(['project'])
    expect(searchEntries(entries, 'project')[0].id).toBe('project:project-1')
    expect(searchEntries(entries, 'tasks').map((entry) => entry.kind)).toEqual(['task'])
  })

  it('permite escopos aninhados por tipo e projeto', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })
    const scoped = getScopedSearchQuery(entries, 'Projetos/API Local/command')

    expect(scoped?.tokens).toMatchObject([
      { label: 'Projetos', color: 'var(--accent)' },
      { label: 'API Local', color: '#45E0B9' },
    ])
    expect(searchEntries(entries, 'Projetos/API Local/command').map((entry) => entry.id)).toEqual([
      'task:project-1:task-1',
    ])
  })

  it('preserva espacos digitados depois do escopo visual', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })

    expect(getScopedSearchQuery(entries, 'Projetos/API Local/ ')?.query).toBe(' ')
    expect(getScopedSearchQuery(entries, 'Projetos/API Local/fazer algo ')?.query).toBe('fazer algo ')
  })

  it('usa tab completion apenas quando o primeiro resultado pode virar escopo', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })
    const projectEntry = searchEntries(entries, 'projetos/api')[0]
    const taskEntry = searchEntries(entries, 'tasks/command')[0]

    expect(completeQueryWithScope(entries, 'projetos/api', projectEntry)).toBe('projetos/API Local/')
    expect(completeQueryWithScope(entries, 'tasks/command', taskEntry)).toBeNull()
  })

  it('usa tab completion para transformar alias digitado em escopo', () => {
    const entries = buildSearchEntries({ workspace, projectDocuments: [projectDocument], t })
    const firstEntry = searchEntries(entries, 'projetos')[0]

    expect(firstEntry.kind).toBe('project')
    expect(completeQueryWithScope(entries, 'projetos', firstEntry)).toBe('projetos/')
    expect(completeQueryWithScope(entries, 'API Local/tasks', firstEntry)).toBe('API Local/tasks/')
  })

  it('ativa apenas command k para a busca global', () => {
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))).toBe(true)
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))).toBe(false)
    expect(matchesShortcut(new KeyboardEvent('keydown', { key: 'f', metaKey: true }))).toBe(false)
  })
})
