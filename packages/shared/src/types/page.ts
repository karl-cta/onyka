export interface NotePage {
  id: string
  noteId: string
  title: string
  content: string
  position: number
  isLocked: boolean
  isDeleted: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NotePageCreateInput {
  title?: string
  content?: string
  position?: number
}

export interface NotePageUpdateInput {
  title?: string
  content?: string
  isLocked?: boolean
}

export interface NotePageReorderInput {
  newPosition: number
}
