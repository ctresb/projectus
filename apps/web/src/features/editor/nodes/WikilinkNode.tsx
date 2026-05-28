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

export type SerializedWikilinkNode = SerializedTextNode & {
  label: string
  targetId: string
}

export class WikilinkNode extends TextNode {
  __targetId: string
  __label: string

  static getType(): string {
    return 'wikilink'
  }

  static clone(node: WikilinkNode): WikilinkNode {
    return new WikilinkNode(node.__targetId, node.__label, node.__key)
  }

  static importJSON(serializedNode: SerializedWikilinkNode): WikilinkNode {
    return $createWikilinkNode(serializedNode.targetId, serializedNode.label).updateFromJSON(serializedNode)
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (domNode.dataset.lexicalType !== 'wikilink') return null
        return {
          conversion: () => ({
            node: $createWikilinkNode(domNode.dataset.targetId ?? domNode.textContent ?? '', domNode.textContent ?? ''),
          }),
          priority: 1,
        }
      },
    }
  }

  constructor(targetId: string, label: string, key?: NodeKey) {
    super(label, key)
    this.__targetId = targetId
    this.__label = label
  }

  getTargetId(): string {
    return this.getLatest().__targetId
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
    dom.className = config.theme.wikilink ?? ''
    dom.dataset.lexicalType = 'wikilink'
    dom.dataset.targetId = this.__targetId
    dom.contentEditable = 'false'
    dom.title = this.__targetId
    return dom
  }

  updateDOM(prevNode: WikilinkNode, dom: HTMLElement, config: EditorConfig): boolean {
    const shouldUpdate = super.updateDOM(prevNode as this, dom, config)
    if (prevNode.__targetId !== this.__targetId) {
      dom.dataset.targetId = this.__targetId
      dom.title = this.__targetId
    }
    return shouldUpdate
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.dataset.lexicalType = 'wikilink'
    element.dataset.targetId = this.__targetId
    element.textContent = this.__label
    return { element }
  }

  exportJSON(): SerializedWikilinkNode {
    return {
      ...super.exportJSON(),
      label: this.__label,
      targetId: this.__targetId,
      type: 'wikilink',
      version: 1,
    }
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedWikilinkNode>): this {
    super.updateFromJSON(serializedNode)
    const writable = this.getWritable()
    writable.__targetId = serializedNode.targetId
    writable.__label = serializedNode.label
    writable.__text = serializedNode.label
    return writable
  }
}

export function $createWikilinkNode(targetId: string, label = targetId): WikilinkNode {
  return $applyNodeReplacement(new WikilinkNode(targetId, label))
}

export function $isWikilinkNode(node: LexicalNode | null | undefined): node is WikilinkNode {
  return node instanceof WikilinkNode
}
