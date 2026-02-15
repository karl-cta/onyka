import { create } from 'zustand'
import type { StatsOverview, StatsPeriod } from '@onyka/shared'
import { statsApi, authApi } from '@/services/api'

interface StatsState {
  overview: StatsOverview | null
  periodStats: StatsPeriod | null
  selectedPeriod: 'week' | 'month' | 'year'
  isLoading: boolean
  error: string | null
  trackingEnabled: boolean
  trackingLoaded: boolean

  // Actions
  fetchOverview: (force?: boolean) => Promise<void>
  fetchPeriodStats: (period?: 'week' | 'month' | 'year', force?: boolean) => Promise<void>
  setSelectedPeriod: (period: 'week' | 'month' | 'year') => void
  resetStats: () => Promise<void>
  clearError: () => void
  fetchTrackingEnabled: () => Promise<void>
  setTrackingEnabled: (enabled: boolean) => Promise<void>
}

export const useStatsStore = create<StatsState>()((set, get) => ({
  overview: null,
  periodStats: null,
  selectedPeriod: 'week',
  isLoading: false,
  error: null,
  trackingEnabled: true,
  trackingLoaded: false,

  fetchOverview: async (force = false) => {
    if (!force && get().overview) return
    set({ isLoading: true, error: null })
    try {
      const { overview } = await statsApi.overview()
      set({ overview, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch stats overview', isLoading: false })
    }
  },

  fetchPeriodStats: async (period, force = false) => {
    const selectedPeriod = period ?? get().selectedPeriod
    if (!force && get().periodStats && get().selectedPeriod === selectedPeriod) {
      set({ selectedPeriod })
      return
    }
    set({ isLoading: true, error: null, selectedPeriod })
    try {
      const { stats } = await statsApi.period(selectedPeriod)
      set({ periodStats: stats, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch period stats', isLoading: false })
    }
  },

  setSelectedPeriod: (period) => {
    set({ selectedPeriod: period })
    get().fetchPeriodStats(period)
  },

  resetStats: async () => {
    set({ isLoading: true, error: null })
    try {
      await statsApi.reset()
      set({
        overview: null,
        periodStats: null,
        isLoading: false,
      })
      await Promise.all([
        get().fetchOverview(),
        get().fetchPeriodStats(),
      ])
    } catch {
      set({ error: 'Failed to reset stats', isLoading: false })
    }
  },

  clearError: () => set({ error: null }),

  fetchTrackingEnabled: async () => {
    try {
      const { trackingEnabled } = await authApi.getTracking()
      set({ trackingEnabled, trackingLoaded: true })
    } catch {
      set({ trackingLoaded: true })
    }
  },

  setTrackingEnabled: async (enabled: boolean) => {
    set({ isLoading: true })
    try {
      const { trackingEnabled } = await authApi.setTracking(enabled)
      // API auto-resets stats when disabling, so clear local state too
      if (!enabled) {
        set({
          trackingEnabled,
          overview: null,
          periodStats: null,
          isLoading: false,
        })
      } else {
        set({ trackingEnabled, isLoading: false })
        await Promise.all([
          get().fetchOverview(),
          get().fetchPeriodStats(),
        ])
      }
    } catch {
      set({ isLoading: false })
      throw new Error('Failed to update tracking preference')
    }
  },
}))
