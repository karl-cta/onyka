import { create } from 'zustand'
import type { User } from '@onyka/shared'
import { authApi, ApiException, type RateLimitInfo, type Auth2FARequiredResponse, resetRefreshState } from '@/services/api'
import { setLanguage } from '@/i18n'
import { useThemeStore, setAuthenticatedState } from './theme'
import { useNotesStore } from './notes'
import { useFoldersStore } from './folders'
import { useTagsStore } from './tags'
import { useSparksStore } from './sparks'
import { useSharesStore } from './shares'
import { useStatsStore } from './stats'
import { useRecapsStore } from './recaps'
import { useCommentsStore } from './comments'
import { usePagesStore } from './pages'
import { useSettingsStore } from './settings'
import { resetSocket } from '@/hooks/useSocket'

/** Resets all user-scoped stores on logout to prevent data leaking between sessions. */
function clearAllUserStores() {
  useNotesStore.setState({ notes: [], currentNote: null, searchResults: [], selectedNoteIds: [], isLoading: false, error: null })
  useFoldersStore.setState({ folders: [], isLoading: false, error: null })
  useTagsStore.setState({ tags: [], isLoading: false, error: null })
  useSparksStore.setState({ pinned: [], temporary: [], permanent: [], stats: null, isLoading: false, error: null, isDrawerOpen: false })
  useSharesStore.setState({ sharedWithMe: [], myShares: [], sharedFolderIds: new Set(), isLoadingSharedWithMe: false, isLoadingMyShares: false })
  useCommentsStore.setState({ commentsByNote: {}, countsByNote: {}, isLoading: false, isSubmitting: false, error: null, expandedNoteId: null, replyingTo: null, editingId: null })
  usePagesStore.setState({ pagesByNote: {}, activePageByNote: {}, isLoading: false, isSaving: false, error: null })
  useSettingsStore.setState({ settings: null, isLoading: false, error: null })

  useStatsStore.setState({
    overview: null,
    periodStats: null,
    selectedPeriod: 'week',
    isLoading: false,
    error: null,
    trackingEnabled: true,
    trackingLoaded: false,
  })
  localStorage.removeItem('onyka-stats')

  useRecapsStore.setState({
    pendingRecap: null,
    history: [],
    isLoading: false,
    error: null,
    hasChecked: false,
    lastDismissedId: null,
  })
  localStorage.removeItem('onyka-recaps')
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  rateLimitInfo: RateLimitInfo | null
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
  setUser: (user: User) => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  rateLimitInfo: null,

  login: async (username, password, rememberMe = false) => {
    set({ error: null, rateLimitInfo: null })
    try {
      const response = await authApi.login({ username, password, rememberMe })

      if ('requires2FA' in response && response.requires2FA) {
        const twoFAResponse = response as Auth2FARequiredResponse
        throw { requires2FA: true, userId: twoFAResponse.userId }
      }

      const user = (response as { user: User }).user
      resetRefreshState()
      if (user.language) {
        setLanguage(user.language)
      }
      await useThemeStore.getState().loadFromUser(user)
      setAuthenticatedState(true)
      set({ user, isAuthenticated: true })
    } catch (err) {
      if (err && typeof err === 'object' && 'requires2FA' in err) {
        throw err
      }
      const message = err instanceof ApiException ? err.message : 'Login failed'
      const rateLimitInfo = err instanceof ApiException ? err.rateLimitInfo : null
      set({ error: message, rateLimitInfo: rateLimitInfo ?? null })
      throw err
    }
  },

  register: async (username, password, email) => {
    set({ error: null })
    try {
      const { user } = await authApi.register({ username, password, email })
      await useThemeStore.getState().loadFromUser(user)
      setAuthenticatedState(true)
      set({ user, isAuthenticated: true })
    } catch (err) {
      let message = 'Registration failed'
      if (err instanceof ApiException) {
        if (err.code === 'VALIDATION_ERROR' && err.details) {
          const fields = Object.keys(err.details)
          if (fields.length > 0) {
            const field = fields[0]
            const fieldMessage = err.details[field]?.[0] || 'Invalid'
            message = `${field}: ${fieldMessage}`
          } else {
            message = err.message
          }
        } else {
          message = err.message
        }
      }
      set({ error: message })
      throw err
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
    } finally {
      setAuthenticatedState(false)
      clearAllUserStores()
      resetSocket()
      set({ user: null, isAuthenticated: false, error: null })
    }
  },

  checkAuth: async () => {
    set({ isLoading: true })
    try {
      const { user } = await authApi.me()
      if (user.language) {
        setLanguage(user.language)
      }
      await useThemeStore.getState().loadFromUser(user)
      setAuthenticatedState(true)
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      setAuthenticatedState(false)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  clearError: () => set({ error: null, rateLimitInfo: null }),

  setUser: (user) => {
    setAuthenticatedState(true)
    set({ user, isAuthenticated: true })
  },

  refreshUser: async () => {
    try {
      const { user } = await authApi.me()
      set({ user })
    } catch {
    }
  },
}))
