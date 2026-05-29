export type KeyboardShortcut = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  label: string
}

export const GLOBAL_SEARCH_SHORTCUT: KeyboardShortcut = {
  key: 'k',
  metaKey: true,
  label: '⌘K',
}

export function matchesShortcut(event: KeyboardEvent, shortcut = GLOBAL_SEARCH_SHORTCUT) {
  if (event.isComposing) return false
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.metaKey === Boolean(shortcut.metaKey) &&
    event.ctrlKey === Boolean(shortcut.ctrlKey) &&
    event.altKey === Boolean(shortcut.altKey) &&
    event.shiftKey === Boolean(shortcut.shiftKey)
  )
}
