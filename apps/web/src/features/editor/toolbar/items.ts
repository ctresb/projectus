import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Link,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { $createParagraphNode, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'

export type SlashItemId =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'check'
  | 'quote'
  | 'code'
  | 'table'
  | 'image'
  | 'hr'
  | 'wikilink'
  | 'mention'

export type CommandActionContext = {
  requestImageUpload?: () => void
}

export type SlashItem = {
  icon: LucideIcon
  id: SlashItemId
  keywords: string[]
  labelKey: string
  run: (editor: LexicalEditor, context?: CommandActionContext) => void
}

function setParagraph(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createParagraphNode())
  })
  editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
}

function setHeading(editor: LexicalEditor, tag: HeadingTagType) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createHeadingNode(tag))
  })
}

function setQuote(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode())
  })
}

function setCode(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createCodeNode('txt'))
  })
}

function insertText(editor: LexicalEditor, text: string) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) selection.insertText(text)
  })
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    icon: Pilcrow,
    id: 'paragraph',
    keywords: ['text', 'body', 'normal'],
    labelKey: 'editor.slash.paragraph',
    run: setParagraph,
  },
  {
    icon: Heading1,
    id: 'h1',
    keywords: ['h1', 'heading', 'title'],
    labelKey: 'editor.slash.h1',
    run: (editor) => setHeading(editor, 'h1'),
  },
  {
    icon: Heading2,
    id: 'h2',
    keywords: ['h2', 'heading', 'subtitle'],
    labelKey: 'editor.slash.h2',
    run: (editor) => setHeading(editor, 'h2'),
  },
  {
    icon: Heading3,
    id: 'h3',
    keywords: ['h3', 'heading'],
    labelKey: 'editor.slash.h3',
    run: (editor) => setHeading(editor, 'h3'),
  },
  {
    icon: List,
    id: 'bullet',
    keywords: ['ul', 'unordered'],
    labelKey: 'editor.slash.bullet',
    run: (editor) => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  },
  {
    icon: ListOrdered,
    id: 'numbered',
    keywords: ['ol', 'ordered'],
    labelKey: 'editor.slash.numbered',
    run: (editor) => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  },
  {
    icon: CheckSquare,
    id: 'check',
    keywords: ['task', 'todo', 'checklist'],
    labelKey: 'editor.slash.check',
    run: (editor) => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  },
  {
    icon: Quote,
    id: 'quote',
    keywords: ['blockquote'],
    labelKey: 'editor.slash.quote',
    run: setQuote,
  },
  {
    icon: Code2,
    id: 'code',
    keywords: ['pre', 'fence'],
    labelKey: 'editor.slash.code',
    run: setCode,
  },
  {
    icon: Table,
    id: 'table',
    keywords: ['grid'],
    labelKey: 'editor.slash.table',
    run: (editor) => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', includeHeaders: true, rows: '3' }),
  },
  {
    icon: Image,
    id: 'image',
    keywords: ['upload', 'picture'],
    labelKey: 'editor.slash.image',
    run: (_editor, context) => context?.requestImageUpload?.(),
  },
  {
    icon: Minus,
    id: 'hr',
    keywords: ['separator', 'rule'],
    labelKey: 'editor.slash.hr',
    run: (editor) => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
  },
  {
    icon: Link,
    id: 'wikilink',
    keywords: ['wiki', 'note', 'entry'],
    labelKey: 'editor.slash.wikilink',
    run: (editor) => insertText(editor, '[['),
  },
  {
    icon: UserRound,
    id: 'mention',
    keywords: ['person', 'user'],
    labelKey: 'editor.slash.mention',
    run: (editor) => insertText(editor, '@'),
  },
]

export function filterSlashItems(items: SlashItem[], query: string, translate: (key: string) => string): SlashItem[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return items
  return items.filter((item) => {
    const label = translate(item.labelKey).toLocaleLowerCase()
    return label.startsWith(normalized) || item.keywords.some((keyword) => keyword.toLocaleLowerCase().startsWith(normalized))
  })
}

export const TOOLBAR_LAYOUT = {
  desktop: ['undo', 'redo', 'block', 'bold', 'italic', 'underline', 'strike', 'code', 'bullet', 'numbered', 'check', 'link', 'insert'],
  mobile: ['undo', 'bold', 'italic', 'bullet', 'insert', 'overflow'],
} as const
