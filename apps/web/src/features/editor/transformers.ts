import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  LINK,
  MULTILINE_ELEMENT_TRANSFORMERS,
  STRIKETHROUGH,
  TEXT_FORMAT_TRANSFORMERS,
  type TextMatchTransformer,
  type Transformer,
} from '@lexical/markdown'
import { $createImageNode, $isImageNode, ImageNode } from './nodes/ImageNode'
import { $createMentionNode, $isMentionNode, MentionNode } from './nodes/MentionNode'
import { $createWikilinkNode, $isWikilinkNode, WikilinkNode } from './nodes/WikilinkNode'

function escapeWikilinkPart(value: string): string {
  return value.replaceAll(']', '\\]')
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function encodeMentionId(value: string): string {
  return encodeURIComponent(value)
}

function decodeMentionId(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const WIKILINK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [WikilinkNode],
  export: (node) => {
    if (!$isWikilinkNode(node)) return null
    const id = node.getTargetId()
    const label = node.getLabel()
    return id === label ? `[[${escapeWikilinkPart(id)}]]` : `[[${escapeWikilinkPart(id)}|${escapeWikilinkPart(label)}]]`
  },
  importRegExp: /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/,
  regExp: /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/,
  replace: (node, match) => {
    const targetId = match[1]
    const label = match[2] ?? targetId
    node.replace($createWikilinkNode(targetId, label))
  },
  trigger: ']',
  type: 'text-match',
}

export const MENTION_TRANSFORMER: TextMatchTransformer = {
  dependencies: [MentionNode],
  export: (node) => {
    if (!$isMentionNode(node)) return null
    return `@[${escapeMarkdownLabel(node.getLabel())}](mention:${encodeMentionId(node.getMentionId())})`
  },
  importRegExp: /@\[([^\]]+)\]\(mention:([^)]+)\)/,
  regExp: /@\[([^\]]+)\]\(mention:([^)]+)\)$/,
  replace: (node, match) => {
    node.replace($createMentionNode(decodeMentionId(match[2]), match[1]))
  },
  trigger: ')',
  type: 'text-match',
}

export const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) return null
    return `![${escapeMarkdownLabel(node.getAltText())}](${node.getSrc()})`
  },
  importRegExp: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/,
  regExp: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/,
  replace: (node, match) => {
    node.replace($createImageNode({ altText: match[1], src: match[2] }))
  },
  trigger: ')',
  type: 'text-match',
}

export const EXTENDED_TRANSFORMERS: Transformer[] = [
  WIKILINK_TRANSFORMER,
  MENTION_TRANSFORMER,
  IMAGE_TRANSFORMER,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  STRIKETHROUGH,
  LINK,
]
