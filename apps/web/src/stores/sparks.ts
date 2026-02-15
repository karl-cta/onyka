import { create } from 'zustand'
import type { Spark, SparkStats, ExpirationOption } from '@onyka/shared'
import { sparksApi } from '@/services/api'

interface PopoverPosition {
  top?: number
  left?: number
  bottom?: number
  right?: number
}

interface SparksState {
  pinned: Spark[]
  temporary: Spark[]
  permanent: Spark[]
  stats: SparkStats | null
  isLoading: boolean
  error: string | null
  isDrawerOpen: boolean
  popoverPosition: PopoverPosition | null
  isQuickAddOpen: boolean

  // Actions
  fetchSparks: () => Promise<void>
  fetchStats: () => Promise<void>
  createSpark: (content: string, options?: { isPinned?: boolean; expiration?: ExpirationOption }) => Promise<Spark>
  updateSpark: (id: string, content: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  deleteSpark: (id: string) => Promise<void>
  convertToNote: (id: string, options: { title?: string; folderId?: string | null }) => Promise<string>
  clearError: () => void
  openDrawer: (position?: PopoverPosition) => void
  closeDrawer: () => void
  toggleDrawer: (position?: PopoverPosition) => void
  openQuickAdd: () => void
  closeQuickAdd: () => void
}

export const useSparksStore = create<SparksState>((set, get) => ({
  pinned: [],
  temporary: [],
  permanent: [],
  stats: null,
  isLoading: false,
  error: null,
  isDrawerOpen: false,
  popoverPosition: null,
  isQuickAddOpen: false,

  fetchSparks: async () => {
    set({ isLoading: true, error: null })
    try {
      const { sparks } = await sparksApi.list()
      set({ pinned: sparks.pinned, temporary: sparks.temporary, permanent: sparks.permanent, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch sparks', isLoading: false })
    }
  },

  fetchStats: async () => {
    try {
      const { stats } = await sparksApi.stats()
      set({ stats })
    } catch {
      // Silent fail for stats
    }
  },

  createSpark: async (content, options = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { spark } = await sparksApi.create({
        content,
        isPinned: options.isPinned,
        expiration: options.expiration,
      })

      set((state) => {
        if (spark.isPinned) {
          return { pinned: [spark, ...state.pinned], isLoading: false }
        } else if (spark.expiresAt) {
          return { temporary: [spark, ...state.temporary], isLoading: false }
        } else {
          return { permanent: [spark, ...state.permanent], isLoading: false }
        }
      })

      get().fetchStats()
      return spark
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create spark'
      set({ error: errorMessage, isLoading: false })
      throw err
    }
  },

  updateSpark: async (id, content) => {
    try {
      const { spark } = await sparksApi.update(id, content)

      set((state) => ({
        pinned: state.pinned.map((s) => (s.id === id ? spark : s)),
        temporary: state.temporary.map((s) => (s.id === id ? spark : s)),
        permanent: state.permanent.map((s) => (s.id === id ? spark : s)),
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update spark'
      set({ error: errorMessage })
      throw err
    }
  },

  togglePin: async (id) => {
    try {
      const { spark } = await sparksApi.togglePin(id)

      set((state) => {
        const newPinned = state.pinned.filter((s) => s.id !== id)
        const newTemporary = state.temporary.filter((s) => s.id !== id)
        const newPermanent = state.permanent.filter((s) => s.id !== id)

        if (spark.isPinned) {
          return {
            pinned: [spark, ...newPinned],
            temporary: newTemporary,
            permanent: newPermanent,
          }
        } else if (spark.expiresAt) {
          return {
            pinned: newPinned,
            temporary: [spark, ...newTemporary],
            permanent: newPermanent,
          }
        } else {
          return {
            pinned: newPinned,
            temporary: newTemporary,
            permanent: [spark, ...newPermanent],
          }
        }
      })

      get().fetchStats()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle pin'
      set({ error: errorMessage })
      throw err
    }
  },

  deleteSpark: async (id) => {
    try {
      await sparksApi.delete(id)
      set((state) => ({
        pinned: state.pinned.filter((s) => s.id !== id),
        temporary: state.temporary.filter((s) => s.id !== id),
        permanent: state.permanent.filter((s) => s.id !== id),
      }))
      get().fetchStats()
    } catch (err) {
      set({ error: 'Failed to delete spark' })
      throw err
    }
  },

  convertToNote: async (id, options) => {
    try {
      const { noteId } = await sparksApi.convert(id, options)

      set((state) => ({
        pinned: state.pinned.filter((s) => s.id !== id),
        temporary: state.temporary.filter((s) => s.id !== id),
        permanent: state.permanent.filter((s) => s.id !== id),
      }))
      get().fetchStats()

      return noteId
    } catch (err) {
      set({ error: 'Failed to convert to note' })
      throw err
    }
  },

  clearError: () => set({ error: null }),

  openDrawer: (position) => set({ isDrawerOpen: true, popoverPosition: position || null }),
  closeDrawer: () => set({ isDrawerOpen: false, popoverPosition: null }),
  toggleDrawer: (position) => set((state) => ({
    isDrawerOpen: !state.isDrawerOpen,
    popoverPosition: state.isDrawerOpen ? null : (position || null),
  })),
  openQuickAdd: () => set({ isQuickAddOpen: true }),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),
}))
