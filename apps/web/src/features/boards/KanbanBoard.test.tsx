import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Column, ProjectCard, Tag, TaskCard } from '../../lib/types'
import { KanbanBoard } from './KanbanBoard'
import { I18nProvider } from '../../i18n'

const columns: Column[] = [
  { id: 'planejado', titulo: 'PLANEJADO', cor: '#55B9F7' },
  { id: 'fazendo', titulo: 'FAZENDO', cor: '#61E141' },
]
const tags: Tag[] = [{ id: 'jogo', titulo: 'jogo', cor: '#FAD344' }]
const metadata = { pasta: 'card-a1b2c3d4', criado_em: '2026-05-26T00:00:00Z', atualizado_em: '2026-05-26T00:00:00Z' }

describe('KanbanBoard compartilhado', () => {
  it('abre uma tarefa por clique sem persistir movimento', () => {
    const task: TaskCard = { ...metadata, id: 'task', titulo: 'Ajustar colisão', status: 'planejado', cor: '#55B9F7', tags: [] }
    const onOpen = vi.fn()
    const onMove = vi.fn().mockResolvedValue(undefined)
    render(
      <I18nProvider locale="pt-BR">
        <KanbanBoard colunas={columns} cards={[task]} tags={tags} vazio="nenhuma tarefa" onOpen={onOpen} onMove={onMove} />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByLabelText('Abrir ou mover Ajustar colisão'))

    expect(onOpen).toHaveBeenCalledWith(task)
    expect(onMove).not.toHaveBeenCalled()
    expect(screen.getByText(/Para mover um card, pressione espaço/)).toBeInTheDocument()
  })

  it('renderiza projetos pelo mesmo board e preserva informacao do repositorio', () => {
    const project: ProjectCard = {
      ...metadata,
      id: 'project',
      titulo: 'Projeto teste',
      github_url: 'https://github.com/exemplo/projeto',
      status: 'fazendo',
      cor: '#61E141',
      tags: ['jogo'],
    }
    render(
      <I18nProvider locale="pt-BR">
        <KanbanBoard
          colunas={columns}
          cards={[project]}
          tags={tags}
          vazio="nenhum projeto"
          onOpen={vi.fn()}
          onMove={vi.fn().mockResolvedValue(undefined)}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('github / exemplo/projeto')).toBeInTheDocument()
    expect(screen.getByText('jogo')).toBeInTheDocument()
  })
})
