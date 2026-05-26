import { useState, type CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import type { ColorChoice, Tag } from '../lib/types'
import { itemId } from '../lib/ids'
import { ColorPicker } from './ColorPicker'

export function TagPicker({
  disponiveis,
  value,
  onChange,
}: {
  disponiveis: Tag[]
  value: string[]
  onChange: (tags: string[]) => void
}) {
  return (
    <div className="tag-picker">
      {disponiveis.map((tag) => (
        <button
          className={value.includes(tag.id) ? 'tag-choice tag-choice--active' : 'tag-choice'}
          style={{ '--tag-color': tag.cor } as CSSProperties}
          key={tag.id}
          type="button"
          onClick={() =>
            onChange(value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id])
          }
        >
          {tag.titulo}
        </button>
      ))}
      {disponiveis.length === 0 && <small>nenhuma tag criada</small>}
    </div>
  )
}

export function NewTagRow({
  cores,
  onCreate,
}: {
  cores: ColorChoice[]
  onCreate: (tag: Tag) => void
}) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(cores[0]?.valor ?? '#55B9F7')
  const submit = () => {
    const clean = title.trim()
    if (!clean) return
    onCreate({ id: itemId('tag', clean), titulo: clean, cor: color })
    setTitle('')
  }
  return (
    <div className="new-tag-row">
      <input
        aria-label="Título da nova tag"
        placeholder="nova tag"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
      />
      <ColorPicker cores={cores} value={color} onChange={setColor} />
      <button className="btn btn--quiet" type="button" onClick={submit} disabled={!title.trim()}>
        <Plus size={13} /> adicionar
      </button>
    </div>
  )
}
