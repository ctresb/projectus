import type { Tag } from '../../lib/types'
import type { GlobalSearchEntry, GlobalSearchTag } from './types'
import { KIND_PRIORITY } from './searchConfig'

export function normalizeSingleValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function normalizeSearchText(values: Array<string | null | undefined>) {
  return normalizeSingleValue(values.filter(Boolean).join(' '))
}

export function mapTags(ids: string[], tags: Tag[]): GlobalSearchTag[] {
  return ids
    .map((id) => {
      const tag = tags.find((candidate) => candidate.id === id)
      return tag ? { id: tag.id, title: tag.titulo, color: tag.cor } : null
    })
    .filter((tag): tag is GlobalSearchTag => Boolean(tag))
}

export function scoreEntry(entry: GlobalSearchEntry, terms: string[]) {
  if (!terms.every((term) => entry.searchText.includes(term))) return 0
  const title = normalizeSingleValue(entry.title)
  const location = normalizeSingleValue(entry.location)
  const description = normalizeSingleValue(entry.description ?? '')
  let score = KIND_PRIORITY[entry.kind]

  for (const term of terms) {
    if (title === term) score += 70
    else if (title.startsWith(term)) score += 48
    else if (title.includes(term)) score += 34
    else if (location.includes(term)) score += 18
    else if (description.includes(term)) score += 12
    else score += 6
  }

  return score
}

export function dateScore(value: string | undefined) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}
