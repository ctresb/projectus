export type SearchEntry = {
  id: string
  label: string
}

export type MentionEntry = {
  id: string
  label: string
  subtitle?: string
}

export type MarkdownEditorHandle = {
  focus: () => void
}

export type MarkdownEditorProps = {
  documentKey: string
  markdown: string
  onChange: (markdown: string) => void
  uploadImage?: (file: File) => Promise<string>
  searchEntries?: (query: string) => Promise<SearchEntry[]>
  searchMentions?: (query: string) => Promise<MentionEntry[]>
  onWikilinkClick?: (id: string) => void
}
