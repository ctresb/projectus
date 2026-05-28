import { TablePlugin as LexicalTablePlugin } from '@lexical/react/LexicalTablePlugin'

export function TablePlugin() {
  return <LexicalTablePlugin hasCellMerge hasCellBackgroundColor={false} hasHorizontalScroll />
}
