import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedTextNode,
} from 'lexical'
import { $applyNodeReplacement, TextNode } from 'lexical'

export type SerializedMentionNode = SerializedTextNode & {
  label: string
  mentionId: string
}

export class MentionNode extends TextNode {
  __mentionId: string
  __label: string

  static getType(): string {
    return 'mention'
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionId, node.__label, node.__key)
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode(serializedNode.mentionId, serializedNode.label).updateFromJSON(serializedNode)
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (domNode.dataset.lexicalType !== 'mention') return null
        return {
          conversion: () => ({
            node: $createMentionNode(domNode.dataset.mentionId ?? domNode.textContent ?? '', domNode.textContent ?? ''),
          }),
          priority: 1,
        }
      },
    }
  }

  constructor(mentionId: string, label: string, key?: NodeKey) {
    super(label, key)
    this.__mentionId = mentionId
    this.__label = label
  }

  getMentionId(): string {
    return this.getLatest().__mentionId
  }

  getLabel(): string {
    return this.getLatest().__label
  }

  isToken(): true {
    return true
  }

  isTextEntity(): true {
    return true
  }

  canInsertTextBefore(): false {
    return false
  }

  canInsertTextAfter(): false {
    return false
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className = config.theme.mention ?? ''
    dom.dataset.lexicalType = 'mention'
    dom.dataset.mentionId = this.__mentionId
    dom.contentEditable = 'false'
    dom.title = this.__mentionId
    return dom
  }

  updateDOM(prevNode: MentionNode, dom: HTMLElement, config: EditorConfig): boolean {
    const shouldUpdate = super.updateDOM(prevNode as this, dom, config)
    if (prevNode.__mentionId !== this.__mentionId) {
      dom.dataset.mentionId = this.__mentionId
      dom.title = this.__mentionId
    }
    return shouldUpdate
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.dataset.lexicalType = 'mention'
    element.dataset.mentionId = this.__mentionId
    element.textContent = this.__label
    return { element }
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      label: this.__label,
      mentionId: this.__mentionId,
      type: 'mention',
      version: 1,
    }
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMentionNode>): this {
    super.updateFromJSON(serializedNode)
    const writable = this.getWritable()
    writable.__mentionId = serializedNode.mentionId
    writable.__label = serializedNode.label
    writable.__text = serializedNode.label
    return writable
  }
}

export function $createMentionNode(mentionId: string, label: string): MentionNode {
  return $applyNodeReplacement(new MentionNode(mentionId, label))
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode
}
