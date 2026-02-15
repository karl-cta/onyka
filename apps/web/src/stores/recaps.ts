import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeeklyRecap } from '@onyka/shared'
import { recapsApi } from '@/services/api'

interface RecapsState {
  pendingRecap: WeeklyRecap | null
  history: WeeklyRecap[]
  isLoading: boolean
  error: string | null
  hasChecked: boolean
  /** Persisted to avoid showing the same recap after page reload. */
  lastDismissedId: string | null
  /** Whether the recap modal is currently open (survives re-mounts). */
  isRecapModalOpen: boolean
  fetchPendingRecap: () => Promise<void>
  fetchHistory: (limit?: number) => Promise<void>
  dismissRecap: (id: string) => Promise<void>
  openRecapModal: () => void
  closeRecapModal: () => void
  clearError: () => void
}

export const useRecapsStore = create<RecapsState>()(
  persist(
    (set, get) => ({
      pendingRecap: null,
      history: [],
      isLoading: false,
      error: null,
      hasChecked: false,
      lastDismissedId: null,
      isRecapModalOpen: false,

      fetchPendingRecap: async () => {
        if (get().hasChecked) return

        set({ isLoading: true, error: null })
        try {
          const { recap } = await recapsApi.pending()
          const { lastDismissedId } = get()

          if (recap && recap.id === lastDismissedId) {
            set({ pendingRecap: null, isLoading: false, hasChecked: true })
            return
          }

          set({ pendingRecap: recap, isLoading: false, hasChecked: true })
        } catch {
          set({ error: 'Failed to fetch pending recap', isLoading: false, hasChecked: true })
        }
      },

      fetchHistory: async (limit = 10) => {
        set({ isLoading: true, error: null })
        try {
          const { recaps } = await recapsApi.history(limit)
          set({ history: recaps, isLoading: false })
        } catch {
          set({ error: 'Failed to fetch recap history', isLoading: false })
        }
      },

      dismissRecap: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          await recapsApi.dismiss(id)
          set({
            pendingRecap: null,
            lastDismissedId: id,
            isRecapModalOpen: false,
            isLoading: false,
          })
        } catch {
          set({ error: 'Failed to dismiss recap', isLoading: false })
        }
      },

      openRecapModal: () => set({ isRecapModalOpen: true }),
      closeRecapModal: () => set({ isRecapModalOpen: false }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'onyka-recaps',
      partialize: (state) => ({
        lastDismissedId: state.lastDismissedId,
      }),
    }
  )
)
