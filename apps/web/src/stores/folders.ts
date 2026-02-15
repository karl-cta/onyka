import { create } from 'zustand'
import type { Folder, FolderNote } from '@onyka/shared'
import { foldersApi, type FolderTreeItem } from '@/services/api'

interface FoldersState {
  folders: Folder[]
  folderTree: FolderTreeItem[]
  rootNotes: FolderNote[]
  selectedFolderId: string | null
  isLoading: boolean
  error: string | null
  expandedFolders: Set<string>
  newNoteId: string | null
  showNewNoteInput: boolean
  selectedFolderIds: string[]
  fetchFolders: () => Promise<void>
  fetchFolderTree: () => Promise<void>
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>
  updateFolder: (id: string, data: { name?: string; icon?: string; parentId?: string | null }) => Promise<void>
  deleteFolder: (id: string, cascade?: boolean) => Promise<void>
  deleteMultipleFolders: (ids: string[]) => Promise<void>
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>
  reorderFolder: (folderId: string, newParentId: string | null, newPosition: number) => Promise<void>
  reorderNote: (noteId: string, newFolderId: string | null, newPosition: number) => Promise<void>
  selectFolder: (id: string | null) => void
  toggleFolderExpanded: (id: string) => void
  clearError: () => void
  setNewNoteId: (id: string | null) => void
  triggerNewNoteInput: () => void
  closeNewNoteInput: () => void
  toggleFolderSelection: (id: string) => void
  clearFolderSelection: () => void
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  folderTree: [],
  rootNotes: [],
  selectedFolderId: null,
  isLoading: false,
  error: null,
  expandedFolders: new Set(),
  newNoteId: null,
  showNewNoteInput: false,
  selectedFolderIds: [],

  fetchFolders: async () => {
    set({ isLoading: true, error: null })
    try {
      const { folders } = await foldersApi.list()
      set({ folders, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch folders', isLoading: false })
    }
  },

  fetchFolderTree: async () => {
    // Only show loading on initial fetch to avoid cascading re-renders
    const isInitialLoad = get().folderTree.length === 0 && get().rootNotes.length === 0
    if (isInitialLoad) {
      set({ isLoading: true, error: null })
    }
    try {
      const { tree, rootNotes } = await foldersApi.tree()
      set({ folderTree: tree, rootNotes, ...(isInitialLoad ? { isLoading: false } : {}) })
    } catch {
      set({ error: 'Failed to fetch folder tree', ...(isInitialLoad ? { isLoading: false } : {}) })
    }
  },

  createFolder: async (name, parentId = null) => {
    set({ isLoading: true, error: null })
    try {
      const { folder } = await foldersApi.create({ name, parentId })
      set((state) => ({
        folders: [...state.folders, folder],
        isLoading: false,
      }))
      get().fetchFolderTree()
      return folder
    } catch (err) {
      set({ error: 'Failed to create folder', isLoading: false })
      throw err
    }
  },

  updateFolder: async (id, data) => {
    try {
      const { folder } = await foldersApi.update(id, data)
      set((state) => ({
        folders: state.folders.map((f) => (f.id === id ? folder : f)),
      }))
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to update folder' })
      throw err
    }
  },

  deleteFolder: async (id, cascade = false) => {
    try {
      await foldersApi.delete(id, cascade)
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== id),
        selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
        selectedFolderIds: state.selectedFolderIds.filter((fid) => fid !== id),
      }))
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to delete folder' })
      throw err
    }
  },

  deleteMultipleFolders: async (ids) => {
    try {
      await Promise.all(ids.map((id) => foldersApi.delete(id, true)))
      set((state) => ({
        folders: state.folders.filter((f) => !ids.includes(f.id)),
        selectedFolderId: state.selectedFolderId && ids.includes(state.selectedFolderId) ? null : state.selectedFolderId,
        selectedFolderIds: [],
      }))
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to delete folders' })
      throw err
    }
  },

  moveNoteToFolder: async (noteId, folderId) => {
    try {
      await foldersApi.moveNote(noteId, folderId)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to move note' })
      throw err
    }
  },

  reorderFolder: async (folderId, newParentId, newPosition) => {
    try {
      await foldersApi.reorder(folderId, newParentId, newPosition)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to reorder folder' })
      throw err
    }
  },

  reorderNote: async (noteId, newFolderId, newPosition) => {
    try {
      await foldersApi.reorderNote(noteId, newFolderId, newPosition)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to reorder note' })
      throw err
    }
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

  toggleFolderExpanded: (id) =>
    set((state) => {
      const expanded = new Set(state.expandedFolders)
      if (expanded.has(id)) {
        expanded.delete(id)
      } else {
        expanded.add(id)
      }
      return { expandedFolders: expanded }
    }),

  clearError: () => set({ error: null }),

  setNewNoteId: (id) => {
    set({ newNoteId: id })
    if (id) {
      setTimeout(() => set({ newNoteId: null }), 1000)
    }
  },

  triggerNewNoteInput: () => set({ showNewNoteInput: true }),
  closeNewNoteInput: () => set({ showNewNoteInput: false }),

  toggleFolderSelection: (id) =>
    set((state) => ({
      selectedFolderIds: state.selectedFolderIds.includes(id)
        ? state.selectedFolderIds.filter((fid) => fid !== id)
        : [...state.selectedFolderIds, id],
    })),

  clearFolderSelection: () => set({ selectedFolderIds: [] }),
}))
