export function resultDomId(entryId: string) {
  return `global-search-result-${entryId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
