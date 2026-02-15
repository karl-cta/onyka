import { create } from 'zustand'
import { request } from '@/services/api'

export interface AppSettings {
  authDisabled: boolean
  allowRegistration: boolean
  appName: string
}

interface SettingsResponse {
  settings: AppSettings
  warning?: string
}

interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  error: string | null
  fetchSettings: () => Promise<void>
  updateSettings: (data: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await request<SettingsResponse>('/settings')
      set({ settings: data.settings, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  updateSettings: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await request<SettingsResponse>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      set({ settings: updated.settings, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },
}))
