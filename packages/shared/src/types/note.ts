export interface Note {
  id: string
  title: string
  content: string
  icon: string
  isQuickNote: boolean
  folderId: string | null
  ownerId: string
  isDeleted: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NoteWithTags extends Note {
  tags: Tag[]
}

export interface NoteCreateInput {
  title?: string
  content?: string
  icon?: string
  isQuickNote?: boolean
  folderId?: string | null
}

export interface NoteUpdateInput {
  title?: string
  content?: string
  icon?: string
  isQuickNote?: boolean
  folderId?: string | null
}

export interface Tag {
  id: string
  name: string
  color: string
  ownerId: string
}

export interface TagCreateInput {
  name: string
  color?: string
}

export interface TagUpdateInput {
  name?: string
  color?: string
}

export interface BlockDocument {
  version: 2
  blocks: Block[]
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | BulletListItemBlock
  | NumberedListItemBlock
  | CheckListItemBlock
  | CodeBlock
  | ImageBlock
  | TableBlock

interface BaseBlock {
  id: string
  children?: Block[]
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph'
  props?: {
    textAlignment?: 'left' | 'center' | 'right'
  }
  content?: InlineContent[]
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading'
  props: {
    level: 1 | 2 | 3
    textAlignment?: 'left' | 'center' | 'right'
  }
  content?: InlineContent[]
}

export interface BulletListItemBlock extends BaseBlock {
  type: 'bulletListItem'
  content?: InlineContent[]
}

export interface NumberedListItemBlock extends BaseBlock {
  type: 'numberedListItem'
  content?: InlineContent[]
}

export interface CheckListItemBlock extends BaseBlock {
  type: 'checkListItem'
  props: {
    checked: boolean
  }
  content?: InlineContent[]
}

export interface CodeBlock extends BaseBlock {
  type: 'codeBlock'
  props?: {
    language?: string
  }
  content?: InlineContent[]
}

export interface ImageBlock extends BaseBlock {
  type: 'image'
  props: {
    url: string
    caption?: string
    width?: number
  }
}

export interface TableBlock extends BaseBlock {
  type: 'table'
  content?: {
    type: 'tableContent'
    rows: TableRow[]
  }
}

export interface TableRow {
  cells: InlineContent[][]
}

export type InlineContent = StyledText | LinkContent

export interface StyledText {
  type: 'text'
  text: string
  styles?: TextStyles
}

export interface LinkContent {
  type: 'link'
  href: string
  content: StyledText[]
}

export interface TextStyles {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
  textColor?: string
  backgroundColor?: string
}
