import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker } from './ColorPicker'
import { NewTagRow } from './TagPicker'

const cores = [
  { id: 'azul', titulo: 'Azul', valor: '#55B9F7' },
  { id: 'verde', titulo: 'Verde', valor: '#61E141' },
]

describe('ColorPicker', () => {
  it('abre uma paleta compacta e seleciona uma cor', () => {
    const onChange = vi.fn()
    render(<ColorPicker cores={cores} value="#55B9F7" label="Cor da tarefa" onChange={onChange} />)

    expect(screen.queryByRole('option', { name: 'Verde' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cor da tarefa' }))
    fireEvent.click(screen.getByRole('option', { name: 'Verde' }))

    expect(onChange).toHaveBeenCalledWith('#61E141')
  })

  it('mostra a cor da tag antes de adicionar', () => {
    const onCreate = vi.fn()
    render(<NewTagRow cores={cores} onCreate={onCreate} />)

    fireEvent.change(screen.getByLabelText('Título da nova tag'), { target: { value: 'bug' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cor da nova tag' }))
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Cor da nova tag' })).getByRole('option', { name: 'Verde' }))
    expect(screen.getByText('bug')).toHaveStyle({ '--tag-color': '#61E141' })

    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'bug', cor: '#61E141' }))
  })
})
