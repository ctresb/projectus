import { LinkPlugin as LexicalLinkPlugin } from '@lexical/react/LexicalLinkPlugin'

function validateUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)
}

export function LinkPlugin() {
  return <LexicalLinkPlugin validateUrl={validateUrl} />
}
