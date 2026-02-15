import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'

export type ImageAlignment = 'left' | 'center' | 'right'
export type ImageBorderStyle = 'none' | 'simple' | 'thick' | 'rounded' | 'shadow' | 'polaroid'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      /**
       * Set image alignment
       */
      setImageAlign: (align: ImageAlignment) => ReturnType
      /**
       * Set image width (percentage or pixels)
       */
      setImageWidth: (width: string | number) => ReturnType
      /**
       * Set image border style
       */
      setImageBorder: (style: ImageBorderStyle) => ReturnType
    }
  }
}

/** Extends base Image with alignment, width, and border support. */
export const CustomImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => {
          return { 'data-align': attributes.align }
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-width') || element.style.width || null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return {
            'data-width': attributes.width,
            style: `width: ${attributes.width}`,
          }
        },
      },
      borderStyle: {
        default: 'none',
        parseHTML: (element) => element.getAttribute('data-border-style') || 'none',
        renderHTML: (attributes) => {
          return { 'data-border-style': attributes.borderStyle || 'none' }
        },
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign:
        (align: ImageAlignment) =>
        ({ commands, state }) => {
          const { selection } = state
          const node = state.doc.nodeAt(selection.from)
          if (node?.type.name !== 'image') return false
          return commands.updateAttributes('image', { align })
        },
      setImageWidth:
        (width: string | number) =>
        ({ commands, state }) => {
          const { selection } = state
          const node = state.doc.nodeAt(selection.from)
          if (node?.type.name !== 'image') return false
          const widthValue = typeof width === 'number' ? `${width}px` : width
          return commands.updateAttributes('image', { width: widthValue })
        },
      setImageBorder:
        (style: ImageBorderStyle) =>
        ({ commands, state }) => {
          const { selection } = state
          const node = state.doc.nodeAt(selection.from)
          if (node?.type.name !== 'image') return false
          return commands.updateAttributes('image', { borderStyle: style })
        },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const align = HTMLAttributes['data-align'] || 'center'
    const borderStyle = HTMLAttributes['data-border-style'] || 'none'
    const borderClass = borderStyle !== 'none' ? ` image-border-${borderStyle}` : ''
    const wrapperClass = `image-wrapper image-align-${align}${borderClass}`

    return [
      'figure',
      { class: wrapperClass },
      [
        'img',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          draggable: 'true',
          contenteditable: 'false',
        }),
      ],
    ]
  },

  parseHTML() {
    return [
      {
        tag: 'figure.image-wrapper img',
      },
      {
        tag: 'img[src]',
      },
    ]
  },
})

export default CustomImage
