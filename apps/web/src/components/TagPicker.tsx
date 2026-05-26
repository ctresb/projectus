import { useState, type CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'motion/react'
import type { ColorChoice, Tag } from '../lib/types'
import { itemId } from '../lib/ids'
import { EASE } from '../lib/motion'
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
        <motion.button
          className={value.includes(tag.id) ? 'tag-choice tag-choice--active' : 'tag-choice'}
          style={{ '--tag-color': tag.cor } as CSSProperties}
          key={tag.id}
          type="button"
          onClick={() =>
            onChange(value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id])
          }
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.12, ease: EASE }}
        >
          {tag.titulo}
        </motion.button>
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
      <motion.span
        className="tag-choice tag-choice--active new-tag-row__preview"
        style={{ '--tag-color': color } as CSSProperties}
        animate={{ borderColor: color, backgroundColor: color }}
        transition={{ duration: 0.14, ease: EASE }}
      >
        {title.trim() || 'prévia'}
      </motion.span>
      <ColorPicker cores={cores} value={color} onChange={setColor} label="Cor da nova tag" />
      <button className="btn btn--quiet" type="button" onClick={submit} disabled={!title.trim()}>
        <Plus size={13} /> adicionar
      </button>
    </div>
  )
}
