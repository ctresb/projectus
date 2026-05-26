export function itemId(prefix: string, title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${prefix}-${slug || 'novo'}-${Date.now().toString(36)}`
}
