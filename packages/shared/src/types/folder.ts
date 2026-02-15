export interface Folder {
  id: string
  name: string
  icon: string
  parentId: string | null
  position: number
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface FolderNote {
  id: string
  title: string
  icon: string
  folderId: string | null
  tagIds: string[]
  position: number
}

// Unified sidebar item type for drag & drop
export type SidebarItemType = 'folder' | 'note'

export interface SidebarItem {
  id: string
  type: SidebarItemType
  position: number
  parentId: string | null // folderId for notes, parentId for folders
}

export interface NoteReorderInput {
  noteId: string
  newFolderId: string | null
  newPosition: number
}

export interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  notes: FolderNote[]
  noteCount: number
}

export interface FolderCreateInput {
  name: string
  icon?: string
  parentId?: string | null
}

export interface FolderUpdateInput {
  name?: string
  icon?: string
  parentId?: string | null
  position?: number
}

export interface FolderReorderInput {
  folderId: string
  newParentId: string | null
  newPosition: number
}
