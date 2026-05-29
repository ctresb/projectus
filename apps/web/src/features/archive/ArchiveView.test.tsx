import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { api } from '../../lib/api'
import type { ArchiveIndex, ArchivedItem, Board, NotesIndex } from '../../lib/types'
import { ArchiveView } from './ArchiveView'

vi.mock('../../lib/api', () => ({
  api: {
    archive: vi.fn(),
    bootstrap: vi.fn(),
    deleteArchived: vi.fn(),
    events: vi.fn(),
    project: vi.fn(),
    restoreArchived: vi.fn(),
  },
}))

const board: Board = { revision: 10, projetos: [] }
const notes: NotesIndex = { revision: 20, notas: [] }

const projectItem: ArchivedItem = {
  id: 'archive-project',
  entidade: 'projeto',
  entidade_id: 'project-1',
  titulo: 'Projeto',
  pasta: 'projeto-archive-project',
  projeto_id: null,
  projeto_titulo: null,
  arquivado_em: '2026-05-27T00:00:00Z',
}

const noteItem: ArchivedItem = {
  id: 'archive-note',
  entidade: 'note',
  entidade_id: 'note-1',
  titulo: 'Nota',
  pasta: 'nota-archive-note',
  projeto_id: null,
  projeto_titulo: null,
  arquivado_em: '2026-05-27T00:00:00Z',
}

const archive: ArchiveIndex = {
  revision: 2,
  itens: [projectItem, noteItem],
}

const workspace = { board, notes, config: {} } as Awaited<ReturnType<typeof api.bootstrap>>

function renderArchiveView(input: ArchiveIndex = archive) {
  vi.mocked(api.archive).mockResolvedValue(input)
  vi.mocked(api.bootstrap).mockResolvedValue(workspace)
  vi.mocked(api.events).mockReturnValue(vi.fn())
  return render(
    <I18nProvider locale="pt-BR">
      <ArchiveView onRefresh={vi.fn().mockResolvedValue(undefined)} onMessage={vi.fn()} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('ArchiveView selection mode', () => {
  it('restaura um item individual usando dados frescos', async () => {
    vi.mocked(api.restoreArchived).mockResolvedValue({ revision: 3, itens: [noteItem] })
    renderArchiveView()

    await screen.findByText('Projeto')
    const row = screen.getByText('Projeto').closest('article')
    expect(row).toBeTruthy()
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /restaurar/i }))

    await waitFor(() => expect(api.bootstrap).toHaveBeenCalled())
    expect(api.restoreArchived).toHaveBeenCalledWith('archive-project', 2, 10)
  })

  it('exclui um item individual usando revisao fresca', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.deleteArchived).mockResolvedValue({ revision: 3, itens: [noteItem] })
    renderArchiveView()

    await screen.findByText('Projeto')
    const row = screen.getByText('Projeto').closest('article')
    expect(row).toBeTruthy()
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /excluir/i }))

    await waitFor(() => expect(api.deleteArchived).toHaveBeenCalled())
    expect(api.deleteArchived).toHaveBeenCalledWith('archive-project', 2)
  })

  it('entra e sai do modo selecao limpando itens selecionados', async () => {
    renderArchiveView()

    await screen.findByText('Projeto')
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByLabelText('selecionar Projeto'))

    expect(screen.getByText('1/2 selecionados')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByText('1/2 selecionados')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('selecionar Projeto')).not.toBeInTheDocument()
  })

  it('seleciona todos e atualiza contador', async () => {
    renderArchiveView()

    await screen.findByText('Projeto')
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByLabelText('selecionar todos os itens arquivados'))

    expect(screen.getByText('2/2 selecionados')).toBeInTheDocument()
  })

  it('nao exclui em massa quando confirmacao e cancelada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderArchiveView()

    await screen.findByText('Projeto')
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByLabelText('selecionar todos os itens arquivados'))
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))

    expect(api.deleteArchived).not.toHaveBeenCalled()
  })

  it('exclui selecionados em sequencia usando revisoes retornadas', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.deleteArchived)
      .mockResolvedValueOnce({ revision: 3, itens: [noteItem] })
      .mockResolvedValueOnce({ revision: 4, itens: [] })
    renderArchiveView()

    await screen.findByText('Projeto')
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByLabelText('selecionar todos os itens arquivados'))
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))

    await waitFor(() => expect(api.deleteArchived).toHaveBeenCalledTimes(2))
    expect(api.deleteArchived).toHaveBeenNthCalledWith(1, 'archive-project', 2)
    expect(api.deleteArchived).toHaveBeenNthCalledWith(2, 'archive-note', 3)
  })

  it('restaura selecionados em sequencia e atualiza workspace', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.restoreArchived)
      .mockResolvedValueOnce({ revision: 3, itens: [noteItem] })
      .mockResolvedValueOnce({ revision: 4, itens: [] })
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    vi.mocked(api.bootstrap).mockResolvedValue(workspace)
    vi.mocked(api.archive).mockResolvedValue(archive)
    vi.mocked(api.events).mockReturnValue(vi.fn())

    render(
      <I18nProvider locale="pt-BR">
        <ArchiveView onRefresh={onRefresh} onMessage={vi.fn()} />
      </I18nProvider>,
    )

    await screen.findByText('Projeto')
    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByLabelText('selecionar todos os itens arquivados'))
    fireEvent.click(screen.getByRole('button', { name: /restaurar/i }))

    await waitFor(() => expect(api.restoreArchived).toHaveBeenCalledTimes(2))
    expect(api.restoreArchived).toHaveBeenNthCalledWith(1, 'archive-project', 2, 10)
    expect(api.restoreArchived).toHaveBeenNthCalledWith(2, 'archive-note', 3, 20)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
