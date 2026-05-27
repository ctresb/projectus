import { useState, type KeyboardEvent } from 'react'
import type { ColorChoice, Tag } from '../lib/types'
import { itemId } from '../lib/ids'
import { randomPaletteColor } from '../lib/colors'
import { useT } from '../i18n'
import { Input } from './ui'

type Props = {
  cores: ColorChoice[]
  onCreate: (tag: Tag) => void
  placeholder?: string
}

export function CommaTagsInput({ cores, onCreate, placeholder }: Props) {
  const t = useT()
  const [draft, setDraft] = useState('')

  const commit = (raw: string) => {
    const clean = raw.trim()
    if (!clean) return
    onCreate({ id: itemId('tag', clean), titulo: clean, cor: randomPaletteColor(cores) })
  }

  const handleChange = (value: string) => {
    if (!value.includes(',')) {
      setDraft(value)
      return
    }
    const parts = value.split(',')
    const tail = parts.pop() ?? ''
    for (const part of parts) commit(part)
    setDraft(tail.trimStart())
  }

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Enter dentro do formulário do modal submeteria sem querer; intercepta sem criar tag.
      event.preventDefault()
    }
  }

  return (
    <div className="comma-tags">
      <Input
        className="comma-tags__input"
        type="text"
        value={draft}
        placeholder={placeholder ?? t('comma_tags.placeholder')}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKey}
        aria-label={t('comma_tags.aria')}
      />
      <small className="comma-tags__hint">{t('comma_tags.hint')}</small>
    </div>
  )
}
