export function markdownBody(markdown: string) {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('# ')) return trimmed
  const newline = trimmed.indexOf('\n')
  return newline === -1 ? '' : trimmed.slice(newline + 1).trimStart()
}
