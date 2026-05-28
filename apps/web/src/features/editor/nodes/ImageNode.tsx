import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
} from 'lexical'
import { $applyNodeReplacement, DecoratorNode } from 'lexical'
import type { JSX } from 'react'
import { editorStyles } from '../theme'

export type SerializedImageNode = SerializedLexicalNode & {
  altText: string
  src: string
  width?: number
}

export type ImagePayload = {
  altText?: string
  src: string
  width?: number
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __altText: string
  __src: string
  __width?: number

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__key)
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode(serializedNode).updateFromJSON(serializedNode)
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (domNode: HTMLElement) => {
        if (!(domNode instanceof HTMLImageElement)) return null
        return {
          conversion: () => ({
            node: $createImageNode({ altText: domNode.alt, src: domNode.src }),
          }),
          priority: 1,
        }
      },
    }
  }

  constructor(src: string, altText = '', width?: number, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width
  }

  getSrc(): string {
    return this.getLatest().__src
  }

  getAltText(): string {
    return this.getLatest().__altText
  }

  getWidth(): number | undefined {
    return this.getLatest().__width
  }

  isInline(): false {
    return false
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('figure')
    element.className = config.theme.image ?? ''
    return element
  }

  updateDOM(): false {
    return false
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img')
    element.src = this.__src
    element.alt = this.__altText
    if (this.__width) element.width = this.__width
    return { element }
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.__altText,
      src: this.__src,
      type: 'image',
      version: 1,
      width: this.__width,
    }
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedImageNode>): this {
    const writable = this.getWritable()
    writable.__src = serializedNode.src
    writable.__altText = serializedNode.altText
    writable.__width = serializedNode.width
    return writable
  }

  decorate(): JSX.Element {
    return (
      <img
        className={editorStyles.imageElement}
        src={this.__src}
        alt={this.__altText}
        style={this.__width ? { width: this.__width } : undefined}
      />
    )
  }
}

export function $createImageNode(payload: ImagePayload): ImageNode {
  return $applyNodeReplacement(new ImageNode(payload.src, payload.altText ?? '', payload.width))
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
