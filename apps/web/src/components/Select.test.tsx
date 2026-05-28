import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Select } from './ui'

const options = [
  { value: 'paragraph', label: 'Parágrafo' },
  { value: 'h1', label: 'Título 1' },
]

afterEach(cleanup)

describe('Select', () => {
  it('closes when the user clicks outside', () => {
    render(
      <>
        <Select label="Tipo" value="paragraph" options={options} onChange={vi.fn()} />
        <button type="button">fora</button>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
    expect(screen.getByRole('listbox', { name: 'Tipo' })).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'fora' }))
    expect(screen.queryByRole('listbox', { name: 'Tipo' })).not.toBeInTheDocument()
  })

  it('clears the active option when the pointer leaves the options', () => {
    render(<Select label="Tipo" value="paragraph" options={options} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
    const listbox = screen.getByRole('listbox', { name: 'Tipo' })
    const option = screen.getByRole('option', { name: 'Título 1' })

    fireEvent.mouseEnter(option)
    expect(option).toHaveClass('select__option--active')

    fireEvent.mouseLeave(listbox)
    expect(option).not.toHaveClass('select__option--active')
  })
})
