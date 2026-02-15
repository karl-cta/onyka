export interface NotePage {
  id: string
  noteId: string
  title: string
  content: string
  position: number
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
}

export interface NotePageReorderInput {
  newPosition: number
}
