import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { api } from '../../lib/api'
import type { Config, IdeaCard } from '../../lib/types'
import { IdeasView } from './IdeasView'

vi.mock('../../lib/api', () => ({
  api: {
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
    ideas: vi.fn(),
    archiveIdea: vi.fn(),
  },
}))

vi.mock('../editor/DeferredMarkdownEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    DeferredMarkdownEditor: React.forwardRef<
      { focus: () => void },
      { documentKey: string; markdown: string; onChange: (markdown: string) => void }
    >(function DeferredMarkdownEditor({ markdown, onChange }, ref) {
      React.useImperativeHandle(ref, () => ({ focus: vi.fn() }), [])
      return <textarea aria-label="draft markdown" value={markdown} onChange={(event) => onChange(event.target.value)} />
    }),
  }
})

vi.mock('./components/IdeaEditor', () => ({
  IdeaEditor: ({ id }: { id: string }) => <div data-testid="idea-editor">{id}</div>,
}))

const config: Config = {
  schema_version: 1,
  revision: 1,
  porta: 4399,
  colunas: [],
  tags: [],
  cores: [{ id: 'azul', titulo: 'Azul', valor: '#55B9F7' }],
  r2: { endpoint: '', bucket: '', region: 'auto', configurado: false, ultimo_snapshot_em: null },
  cor_principal: '#FAD344',
  lan_exposto: false,
  idioma: 'pt-BR',
}

const createdIdea: IdeaCard = {
  id: 'idea-1',
  pasta: 'nova-ideia-idea-1',
  titulo: 'nova ideia',
  cor: '#55B9F7',
  criado_em: '2026-05-27T00:00:00Z',
  atualizado_em: '2026-05-27T00:00:00Z',
}

function renderIdeasView() {
  return render(
    <I18nProvider locale="pt-BR">
      <IdeasView config={config} ideas={{ revision: 1, notas: [] }} onIdeas={vi.fn()} onMessage={vi.fn()} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('IdeasView quick create', () => {
  it('cria uma unica ideia e atualiza a mesma nota enquanto o usuario digita', async () => {
    vi.useFakeTimers()
    vi.mocked(api.createIdea).mockResolvedValue({ dados: createdIdea, markdown: '# nova ideia\n\na' })
    vi.mocked(api.updateIdea).mockResolvedValue({ dados: createdIdea, markdown: '# nova ideia\n\nabc' })
    vi.mocked(api.ideas).mockResolvedValue({ revision: 2, notas: [createdIdea] })

    renderIdeasView()

    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: 'b' })
    fireEvent.keyDown(window, { key: 'c' })

    await act(async () => Promise.resolve())

    expect(api.createIdea).toHaveBeenCalledTimes(1)
    expect(api.createIdea).toHaveBeenCalledWith({ titulo: 'nova ideia', markdown: 'a' })

    await act(async () => vi.advanceTimersByTimeAsync(160))
    await act(async () => Promise.resolve())

    expect(api.updateIdea).toHaveBeenCalledTimes(1)
    expect(api.updateIdea).toHaveBeenCalledWith(
      'idea-1',
      expect.objectContaining({
        markdown: 'abc',
        titulo: 'nova ideia',
      }),
    )

    await act(async () => vi.advanceTimersByTimeAsync(160))
  })

  it('mantem o titulo visivel quando cria ideia vazia com command n', async () => {
    vi.useFakeTimers()
    vi.mocked(api.createIdea).mockReturnValue(new Promise(() => undefined))

    renderIdeasView()

    fireEvent.keyDown(window, { key: 'n', metaKey: true })

    expect(api.createIdea).toHaveBeenCalledWith({ titulo: 'nova ideia', markdown: '' })
    expect(screen.getAllByDisplayValue('nova ideia')).toHaveLength(1)
  })
})
