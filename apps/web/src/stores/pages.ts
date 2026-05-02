import { create } from 'zustand'
import type { NotePage, NotePageCreateInput, NotePageUpdateInput } from '@onyka/shared'
import { pagesApi } from '@/services/api'

interface PagesState {
  pagesByNote: Record<string, NotePage[]>
  activePageByNote: Record<string, string>
  isLoading: boolean
  isSaving: boolean
  error: string | null
  fetchPages: (noteId: string) => Promise<void>
  createPage: (noteId: string, input?: NotePageCreateInput, switchTo?: boolean) => Promise<NotePage | null>
  updatePage: (pageId: string, input: NotePageUpdateInput) => Promise<void>
  deletePage: (noteId: string, pageId: string) => Promise<void>
  reorderPage: (noteId: string, pageId: string, newPosition: number) => Promise<void>
  refetchPages: (noteId: string) => Promise<void>
  applyPageOrder: (noteId: string, orderedIds: string[]) => void
  setActivePage: (noteId: string, pageId: string) => void
  getActivePage: (noteId: string) => NotePage | null
  clearNotePages: (noteId: string) => void
  clearError: () => void
  patchPageContent: (pageId: string, content: string) => void
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pagesByNote: {},
  activePageByNote: {},
  isLoading: false,
  isSaving: false,
  error: null,

  fetchPages: async (noteId: string) => {
    // Skip if already loaded — pages refresh on create/delete/reorder
    if (get().pagesByNote[noteId] !== undefined) return

    set({ isLoading: true, error: null })
    try {
      const { pages } = await pagesApi.list(noteId)
      set((state) => ({
        pagesByNote: { ...state.pagesByNote, [noteId]: pages },
        activePageByNote: {
          ...state.activePageByNote,
          [noteId]: state.activePageByNote[noteId] || pages[0]?.id || '',
        },
        isLoading: false,
      }))
    } catch {
      set({ error: 'Failed to fetch pages', isLoading: false })
    }
  },

  createPage: async (noteId: string, input?: NotePageCreateInput, switchTo = true) => {
    set({ isSaving: true, error: null })
    try {
      const { page } = await pagesApi.create(noteId, input || {})
      set((state) => ({
        pagesByNote: {
          ...state.pagesByNote,
          [noteId]: [...(state.pagesByNote[noteId] || []), page],
        },
        activePageByNote: {
          ...state.activePageByNote,
          ...(switchTo ? { [noteId]: page.id } : {}),
        },
        isSaving: false,
      }))
      return page
    } catch {
      set({ error: 'Failed to create page', isSaving: false })
      return null
    }
  },

  updatePage: async (pageId: string, input: NotePageUpdateInput) => {
    const noteId = findNoteIdForPage(get().pagesByNote, pageId)
    if (!noteId) return

    try {
      const { page } = await pagesApi.update(pageId, input)
      set((state) => ({
        pagesByNote: {
          ...state.pagesByNote,
          [noteId]: state.pagesByNote[noteId].map((p) =>
            p.id === pageId ? page : p
          ),
        },
      }))
    } catch {
      set({ error: 'Failed to update page' })
    }
  },

  deletePage: async (noteId: string, pageId: string) => {
    const pages = get().pagesByNote[noteId]
    if (!pages || pages.length <= 1) {
      set({ error: 'Cannot delete the last page' })
      return
    }

    set({ isSaving: true, error: null })
    try {
      await pagesApi.delete(pageId)
      const remainingPages = pages.filter((p) => p.id !== pageId)
      const activePageId = get().activePageByNote[noteId]

      set((state) => ({
        pagesByNote: {
          ...state.pagesByNote,
          [noteId]: remainingPages,
        },
        activePageByNote: {
          ...state.activePageByNote,
          [noteId]: activePageId === pageId
            ? remainingPages[0]?.id || ''
            : activePageId,
        },
        isSaving: false,
      }))
    } catch {
      set({ error: 'Failed to delete page', isSaving: false })
    }
  },

  reorderPage: async (noteId: string, pageId: string, newPosition: number) => {
    try {
      await pagesApi.reorder(pageId, newPosition)
      await get().refetchPages(noteId)
    } catch {
      set({ error: 'Failed to reorder page' })
    }
  },

  refetchPages: async (noteId: string) => {
    try {
      const { pages } = await pagesApi.list(noteId)
      set((state) => ({
        pagesByNote: { ...state.pagesByNote, [noteId]: pages },
      }))
    } catch {
      set({ error: 'Failed to refresh pages' })
    }
  },

  applyPageOrder: (noteId: string, orderedIds: string[]) => {
    set((state) => {
      const current = state.pagesByNote[noteId]
      if (!current) return state
      const byId = new Map(current.map((p) => [p.id, p]))
      const next = orderedIds
        .map((id, position) => {
          const page = byId.get(id)
          return page ? { ...page, position } : null
        })
        .filter((p): p is NotePage => p !== null)
      if (next.length !== current.length) return state
      return {
        pagesByNote: { ...state.pagesByNote, [noteId]: next },
      }
    })
  },

  setActivePage: (noteId: string, pageId: string) => {
    set((state) => ({
      activePageByNote: {
        ...state.activePageByNote,
        [noteId]: pageId,
      },
    }))
  },

  getActivePage: (noteId: string) => {
    const state = get()
    const pages = state.pagesByNote[noteId]
    const activeId = state.activePageByNote[noteId]
    return pages?.find((p) => p.id === activeId) || pages?.[0] || null
  },

  clearNotePages: (noteId: string) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [noteId]: _removedPages, ...restPages } = state.pagesByNote
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [noteId]: _removedActive, ...restActive } = state.activePageByNote
      return {
        pagesByNote: restPages,
        activePageByNote: restActive,
      }
    })
  },

  clearError: () => set({ error: null }),

  patchPageContent: (pageId: string, content: string) => {
    const noteId = findNoteIdForPage(get().pagesByNote, pageId)
    if (!noteId) return
    set((state) => ({
      pagesByNote: {
        ...state.pagesByNote,
        [noteId]: state.pagesByNote[noteId].map((p) =>
          p.id === pageId ? { ...p, content } : p
        ),
      },
    }))
  },
}))

function findNoteIdForPage(
  pagesByNote: Record<string, NotePage[]>,
  pageId: string
): string | null {
  for (const [noteId, pages] of Object.entries(pagesByNote)) {
    if (pages.some((p) => p.id === pageId)) return noteId
  }
  return null
}
