import type { CSSProperties } from 'react'
import type { ColorChoice } from '../lib/types'

type Props = {
  cores: ColorChoice[]
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ cores, value, onChange }: Props) {
  return (
    <div className="palette" aria-label="Cor">
      {cores.map((color) => (
        <button
          className={`palette__swatch ${value === color.valor ? 'palette__swatch--active' : ''}`}
          type="button"
          key={color.id}
          style={{ '--swatch': color.valor } as CSSProperties}
          aria-label={color.titulo}
          aria-pressed={value === color.valor}
          onClick={() => onChange(color.valor)}
        />
      ))}
    </div>
  )
}
