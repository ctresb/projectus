import { describe, expect, it } from 'vitest'
import { filterSlashItems, SLASH_ITEMS } from '../toolbar/items'

const labels: Record<string, string> = {
  'editor.slash.h2': 'Heading 2',
  'editor.slash.image': 'Image',
}

describe('slash menu filtering', () => {
  it('filters by localized label prefix and keyword prefix', () => {
    expect(filterSlashItems(SLASH_ITEMS, 'hea', (key) => labels[key] ?? key).map((item) => item.id)).toContain('h2')
    expect(filterSlashItems(SLASH_ITEMS, 'upload', (key) => labels[key] ?? key).map((item) => item.id)).toEqual([
      'image',
    ])
  })
})
