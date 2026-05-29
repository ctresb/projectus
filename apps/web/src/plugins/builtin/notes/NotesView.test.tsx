import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n'
import { pluginRegistry } from '../../registry/PluginRegistry'
import { notesApi } from './notesApi'
import { NOTES_I18N } from './i18n'
import type { Config, Note } from '../../../lib/types'
import { NotesView, type NotesViewHandle } from './NotesView'

vi.mock('./notesApi', () => ({
  notesApi: {
    createNote: vi.fn(),
    updateNote: vi.fn(),
    notes: vi.fn(),
    archiveNote: vi.fn(),
  },
}))

vi.mock('../../../features/editor/DeferredMarkdownEditor', async () => {
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

vi.mock('./components/NoteEditor', () => ({
  NoteEditor: ({ id }: { id: string }) => <div data-testid="note-editor">{id}</div>,
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

const createdNote: Note = {
  id: 'note-1',
  pasta: 'nova-nota-note-1',
  titulo: 'nova nota',
  cor: '#55B9F7',
  criado_em: '2026-05-27T00:00:00Z',
  atualizado_em: '2026-05-27T00:00:00Z',
}

function renderNotesView(ref?: React.Ref<NotesViewHandle>) {
  return render(
    <I18nProvider locale="pt-BR">
      <NotesView ref={ref} config={config} notes={{ revision: 1, notas: [] }} onNotes={vi.fn()} onMessage={vi.fn()} />
    </I18nProvider>,
  )
}

// `NotesView` reads its strings through `useT` against the host `I18nProvider`,
// which overlays plugin-contributed dictionaries from the shared registry. The
// Notes `notes.*` strings live in this plugin's `NOTES_I18N` overlay (core no
// longer ships them), so register it before each render — mirroring what the
// plugin's `activate` does — and tear it down after so tests stay isolated.
beforeEach(() => {
  pluginRegistry.registerI18n({ pluginId: 'notes', id: 'i18n', dictionaries: NOTES_I18N })
})

afterEach(() => {
  pluginRegistry.unregisterPlugin('notes')
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('NotesView quick create', () => {
  it('cria uma unica nota e atualiza a mesma nota enquanto o usuario digita', async () => {
    vi.useFakeTimers()
    vi.mocked(notesApi.createNote).mockResolvedValue({ dados: createdNote, markdown: '# nova nota\n\na' })
    vi.mocked(notesApi.updateNote).mockResolvedValue({ dados: createdNote, markdown: '# nova nota\n\nabc' })
    vi.mocked(notesApi.notes).mockResolvedValue({ revision: 2, notas: [createdNote] })

    const ref = createRef<NotesViewHandle>()
    renderNotesView(ref)

    act(() => ref.current?.quickCreate('a'))

    await act(async () => Promise.resolve())

    expect(notesApi.createNote).toHaveBeenCalledTimes(1)
    expect(notesApi.createNote).toHaveBeenCalledWith({ titulo: 'nova nota', markdown: 'a' })

    fireEvent.change(screen.getByLabelText('draft markdown'), { target: { value: 'abc' } })

    await act(async () => vi.advanceTimersByTimeAsync(160))
    await act(async () => Promise.resolve())

    expect(notesApi.updateNote).toHaveBeenCalledTimes(1)
    expect(notesApi.updateNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        markdown: 'abc',
        titulo: 'nova nota',
      }),
    )

    await act(async () => vi.advanceTimersByTimeAsync(160))
  })

  it('mantem o titulo visivel quando cria nota vazia via quick create', async () => {
    vi.useFakeTimers()
    vi.mocked(notesApi.createNote).mockReturnValue(new Promise(() => undefined))

    const ref = createRef<NotesViewHandle>()
    renderNotesView(ref)

    act(() => ref.current?.quickCreate(''))

    expect(notesApi.createNote).toHaveBeenCalledWith({ titulo: 'nova nota', markdown: '' })
    expect(screen.getAllByDisplayValue('nova nota')).toHaveLength(1)
  })
})
