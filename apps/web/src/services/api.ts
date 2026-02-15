import type {
  User,
  UserPreferences,
  Note,
  NoteWithTags,
  NoteCreateInput,
  NoteUpdateInput,
  NotePage,
  NotePageCreateInput,
  NotePageUpdateInput,
  Folder,
  FolderNote,
  Tag,
  TagCreateInput,
  TagUpdateInput,
  ShareWithUser,
  ShareWithOwner,
  ShareCreateInput,
  Permission,
  Collaborator,
  StatsOverview,
  StatsPeriod,
  WeeklyRecap,
  CommentWithUser,
  CommentWithReplies,
  Spark,
  SparkCreateInput,
  SparkStats,
  SparksList,
} from '@onyka/shared'

const API_BASE = '/api'

export interface RateLimitInfo {
  retryAfter: number // seconds until lockout expires
  remainingAttempts?: number
  maxAttempts?: number
}

export class ApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, string[]>,
    public rateLimitInfo?: RateLimitInfo
  ) {
    super(message)
    this.name = 'ApiException'
  }
}

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null
let refreshFailureCount = 0
const MAX_REFRESH_RETRIES = 3
const REFRESH_RETRY_DELAY = 1000

async function refreshToken(retryCount = 0): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.ok) {
      refreshFailureCount = 0
      return true
    }

    // Client errors (4xx) are definitive -- don't retry
    if (response.status >= 400 && response.status < 500) {
      return false
    }

    if (retryCount < MAX_REFRESH_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY * (retryCount + 1)))
      return refreshToken(retryCount + 1)
    }

    return false
  } catch {
    if (retryCount < MAX_REFRESH_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY * (retryCount + 1)))
      return refreshToken(retryCount + 1)
    }
    return false
  }
}

async function handleTokenRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  refreshFailureCount++
  if (refreshFailureCount > MAX_REFRESH_RETRIES * 2) {
    console.warn('[Auth] Too many refresh failures, stopping retry attempts')
    return false
  }

  isRefreshing = true
  refreshPromise = refreshToken()

  try {
    const success = await refreshPromise
    return success
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}

export function resetRefreshState(): void {
  refreshFailureCount = 0
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json().catch(() => ({
      error: { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' },
    }))
    const error = typeof data.error === 'object' ? data.error : { code: 'UNKNOWN_ERROR', message: String(data.error || 'An unknown error occurred') }
    // Extract waitSeconds from rate-limited responses (2FA code cooldown)
    const rateLimitInfo = error.rateLimitInfo ||
      (data.waitSeconds ? { retryAfter: data.waitSeconds } : undefined)
    throw new ApiException(
      error.code,
      error.message,
      response.status,
      error.details,
      rateLimitInfo
    )
  }
  return response.json()
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOnUnauthorized = true
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Attempt token refresh on 401 (except auth endpoints)
  if (response.status === 401 && retryOnUnauthorized) {
    const noRefreshEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
    const shouldSkipRefresh = noRefreshEndpoints.some(ep => endpoint.startsWith(ep))

    if (!shouldSkipRefresh) {
      const refreshed = await handleTokenRefresh()

      if (refreshed) {
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        })
        return handleResponse<T>(retryResponse)
      }
    }
  }

  return handleResponse<T>(response)
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
}

export interface AuthResponse {
  user: User
}

export interface Auth2FARequiredResponse {
  requires2FA: true
  userId: string
}

export type LoginResponse = AuthResponse | Auth2FARequiredResponse

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  me: () => request<{ user: User }>('/auth/me'),

  refresh: () =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
    }),

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    request<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  completeOnboarding: () =>
    request<{ onboardingCompleted: boolean }>('/auth/onboarding/complete', {
      method: 'PATCH',
    }),

  getTracking: () => request<{ trackingEnabled: boolean }>('/auth/tracking'),

  setTracking: (enabled: boolean) =>
    request<{ trackingEnabled: boolean }>('/auth/tracking', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  uploadAvatar: async (file: File): Promise<{ user: User; avatarUrl: string }> => {
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || 'Failed to upload avatar')
    }

    return response.json()
  },

  removeAvatar: () =>
    request<{ user: User }>('/users/me/avatar', {
      method: 'DELETE',
    }),
}

export interface Session {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: Date | string
  isCurrent: boolean
}

export const sessionsApi = {
  list: async (): Promise<{ sessions: Session[] }> => {
    return request<{ sessions: Session[] }>('/auth/sessions')
  },

  revoke: async (sessionId: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  },

  revokeAllOthers: async (): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>('/auth/sessions', {
      method: 'DELETE',
    })
  },
}

export type ExportFormat = 'md' | 'txt' | 'html'

export interface NotesListParams {
  folderId?: string | null
  tagIds?: string[]
  deleted?: boolean
}

export interface SearchResult {
  id: string
  title: string
  preview: string
  score: number
}

export const notesApi = {
  list: (params: NotesListParams = {}) => {
    const searchParams = new URLSearchParams()
    if (params.folderId !== undefined) {
      searchParams.set('folderId', params.folderId === null ? 'null' : params.folderId)
    }
    if (params.tagIds?.length) searchParams.set('tagIds', params.tagIds.join(','))
    if (params.deleted) searchParams.set('deleted', 'true')
    const query = searchParams.toString()
    return request<{ notes: Note[] }>(`/notes${query ? `?${query}` : ''}`)
  },

  get: (id: string) => request<{ note: NoteWithTags }>(`/notes/${id}`),

  create: (data: NoteCreateInput) =>
    request<{ note: Note }>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: NoteUpdateInput) =>
    request<{ note: Note }>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/notes/${id}`, {
      method: 'DELETE',
    }),

  restore: (id: string) =>
    request<{ note: Note }>(`/notes/${id}/restore`, {
      method: 'POST',
    }),

  search: (query: string) =>
    request<{ results: SearchResult[] }>(`/notes/search?q=${encodeURIComponent(query)}`),

  sharedWithMe: () => request<{ notes: Note[] }>('/notes/shared-with-me'),

  addTag: (noteId: string, tagId: string) =>
    request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, {
      method: 'POST',
    }),

  removeTag: (noteId: string, tagId: string) =>
    request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, {
      method: 'DELETE',
    }),
}

export interface FolderTreeItem extends Folder {
  children: FolderTreeItem[]
  notes: FolderNote[]
  noteCount: number
}

export const foldersApi = {
  list: () => request<{ folders: Folder[] }>('/folders'),

  tree: () => request<{ tree: FolderTreeItem[]; rootNotes: FolderNote[] }>('/folders/tree'),

  create: (data: { name: string; parentId?: string | null }) =>
    request<{ folder: Folder }>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; icon?: string; parentId?: string | null }) =>
    request<{ folder: Folder }>(`/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string, cascade = false) =>
    request<{ success: boolean }>(`/folders/${id}?cascade=${cascade}`, {
      method: 'DELETE',
    }),

  moveNote: (noteId: string, folderId: string | null) =>
    request<{ success: boolean }>('/folders/move-note', {
      method: 'POST',
      body: JSON.stringify({ noteId, folderId }),
    }),

  reorder: (folderId: string, newParentId: string | null, newPosition: number) =>
    request<{ folder: Folder }>('/folders/reorder', {
      method: 'POST',
      body: JSON.stringify({ folderId, newParentId, newPosition }),
    }),

  reorderNote: (noteId: string, newFolderId: string | null, newPosition: number) =>
    request<{ note: Note }>('/folders/reorder-note', {
      method: 'POST',
      body: JSON.stringify({ noteId, newFolderId, newPosition }),
    }),
}

export interface TagWithCount extends Tag {
  noteCount: number
}

export const tagsApi = {
  list: (withCounts = false) =>
    request<{ tags: TagWithCount[] }>(`/tags${withCounts ? '?withCounts=true' : ''}`),

  create: (data: TagCreateInput) =>
    request<{ tag: Tag }>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: TagUpdateInput) =>
    request<{ tag: Tag }>(`/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/tags/${id}`, {
      method: 'DELETE',
    }),
}

export const sharesApi = {
  list: () => request<{ shares: ShareWithUser[] }>('/shares'),

  sharedWithMe: () => request<{ shares: ShareWithOwner[] }>('/shares?type=shared_with_me'),

  getForResource: (resourceType: string, resourceId: string) =>
    request<{ collaborators: Collaborator[] }>(
      `/shares?resourceType=${resourceType}&resourceId=${resourceId}`
    ),

  create: (data: ShareCreateInput) =>
    request<{ share: ShareWithUser }>('/shares', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (shareId: string, permission: Permission) =>
    request<{ share: ShareWithUser }>(`/shares/${shareId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permission }),
    }),

  delete: (shareId: string) =>
    request<{ success: boolean }>(`/shares/${shareId}`, {
      method: 'DELETE',
    }),
}

export interface UserSearchResult {
  id: string
  username: string
  name: string
  avatarUrl?: string
  avatarColor?: string
}

export const usersApi = {
  search: (query: string) =>
    request<{ users: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(query)}`),

  updatePreferences: (prefs: Partial<UserPreferences>) =>
    request<{ user: User }>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
}

export const statsApi = {
  overview: () => request<{ overview: StatsOverview }>('/stats/overview'),

  period: (period: 'week' | 'month' | 'year') =>
    request<{ stats: StatsPeriod }>(`/stats/period?period=${period}`),

  reset: () => request<{ success: boolean }>('/stats/reset', { method: 'DELETE' }),

  trackFocus: (minutes: number) =>
    request<{ success: boolean }>('/stats/focus', {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),
}

export const exportApi = {
  noteUrl: (noteId: string, format: ExportFormat = 'md'): string =>
    `${API_BASE}/export/note/${noteId}?format=${format}`,

  folderUrl: (folderId: string, format: ExportFormat = 'md'): string =>
    `${API_BASE}/export/folder/${folderId}?format=${format}`,
}

export const recapsApi = {
  pending: () => request<{ recap: WeeklyRecap | null }>('/recaps/pending'),

  history: (limit = 10) =>
    request<{ recaps: WeeklyRecap[] }>(`/recaps/history?limit=${limit}`),

  dismiss: (id: string) =>
    request<{ success: boolean }>(`/recaps/${id}/dismiss`, { method: 'PATCH' }),
}

export const commentsApi = {
  list: (noteId: string) =>
    request<{ comments: CommentWithReplies[] }>(`/comments/note/${noteId}`),

  count: (noteId: string) =>
    request<{ count: number }>(`/comments/note/${noteId}/count`),

  create: (noteId: string, content: string, parentId?: string) =>
    request<{ comment: CommentWithUser }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ noteId, content, parentId }),
    }),

  update: (commentId: string, content: string) =>
    request<{ comment: CommentWithUser }>(`/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  delete: (commentId: string) =>
    request<{ success: boolean }>(`/comments/${commentId}`, {
      method: 'DELETE',
    }),
}

export const pagesApi = {
  list: (noteId: string) =>
    request<{ pages: NotePage[] }>(`/pages/note/${noteId}`),

  get: (pageId: string) =>
    request<{ page: NotePage }>(`/pages/${pageId}`),

  create: (noteId: string, data: NotePageCreateInput = {}) =>
    request<{ page: NotePage }>(`/pages/note/${noteId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (pageId: string, data: NotePageUpdateInput) =>
    request<{ page: NotePage }>(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (pageId: string) =>
    request<{ success: boolean }>(`/pages/${pageId}`, {
      method: 'DELETE',
    }),

  reorder: (pageId: string, newPosition: number) =>
    request<{ page: NotePage }>(`/pages/${pageId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ newPosition }),
    }),
}

export const sparksApi = {
  list: () => request<{ sparks: SparksList }>('/sparks'),

  stats: () => request<{ stats: SparkStats }>('/sparks/stats'),

  create: (input: SparkCreateInput) =>
    request<{ spark: Spark }>('/sparks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, content: string) =>
    request<{ spark: Spark }>(`/sparks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  togglePin: (id: string) =>
    request<{ spark: Spark }>(`/sparks/${id}/pin`, {
      method: 'PATCH',
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/sparks/${id}`, {
      method: 'DELETE',
    }),

  convert: (id: string, options: { title?: string; folderId?: string | null }) =>
    request<{ spark: Spark; noteId: string }>(`/sparks/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
}

export interface AdminUser {
  id: string
  username: string
  name: string
  email?: string
  emailVerified: boolean
  avatarUrl?: string
  avatarColor?: string
  role: 'user' | 'admin'
  isDisabled: boolean
  disabledReason?: string
  twoFactorEnabled: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  disabledUsers: number
  adminCount: number
  usersWithEmail: number
  usersWith2FA: number
}

export interface AuditLogEntry {
  id: string
  adminId: string
  adminUsername: string
  action: string
  targetType?: string
  targetId?: string
  targetUsername?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export const adminApi = {
  listUsers: (params?: { page?: number; limit?: number; search?: string; status?: 'active' | 'disabled' | 'all' }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return request<{ users: AdminUser[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(`/admin/users${query ? `?${query}` : ''}`)
  },

  disableUser: (userId: string, reason?: string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}/disable`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  enableUser: (userId: string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}/enable`, {
      method: 'PATCH',
    }),

  deleteUser: (userId: string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  changeUserRole: (userId: string, role: 'user' | 'admin') =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  changeUsername: (userId: string, username: string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}/username`, {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    }),

  sendPasswordReset: (userId: string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${userId}/send-password-reset`, {
      method: 'POST',
    }),

  getStats: () => request<{ stats: AdminStats }>('/admin/stats'),

  getAuditLogs: (params?: {
    page?: number
    limit?: number
    action?: string
    adminId?: string
    targetId?: string
    startDate?: string
    endDate?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.action) searchParams.set('action', params.action)
    if (params?.adminId) searchParams.set('adminId', params.adminId)
    if (params?.targetId) searchParams.set('targetId', params.targetId)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    const query = searchParams.toString()
    return request<{
      logs: AuditLogEntry[]
      pagination: { total: number; page: number; limit: number; totalPages: number }
    }>(`/admin/audit-logs${query ? `?${query}` : ''}`)
  },
}

export interface TwoFactorStatus {
  enabled: boolean
  hasVerifiedEmail: boolean
  recoveryCodesRemaining: number
}

export interface TrustedDeviceInfo {
  id: string
  label: string
  ipAddress: string | null
  createdAt: string
  expiresAt: string
}

export type TwoFactorPurpose = 'enable_2fa' | 'disable_2fa'

export const twoFactorApi = {
  getStatus: () => request<TwoFactorStatus>('/auth/2fa/status'),

  sendCode: (purpose: TwoFactorPurpose) =>
    request<{ sent: boolean; message: string }>('/auth/2fa/send-code', {
      method: 'POST',
      body: JSON.stringify({ purpose }),
    }),

  sendLoginCode: (userId: string) =>
    request<{ sent: boolean; message: string }>('/auth/2fa/send-login-code', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  enable: (code: string) =>
    request<{ message: string; recoveryCodes: string[] }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable: (password: string, code: string) =>
    request<{ message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),

  regenerateCodes: (password: string) =>
    request<{ recoveryCodes: string[]; message: string }>('/auth/2fa/regenerate-codes', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  verify: (userId: string, code: string, isRecoveryCode = false, rememberMe = false, trustDevice = false) =>
    request<{ user: User; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, code, isRecoveryCode, rememberMe, trustDevice }),
    }),

  listTrustedDevices: () =>
    request<{ devices: TrustedDeviceInfo[] }>('/auth/trusted-devices'),

  revokeTrustedDevice: (id: string) =>
    request<{ success: boolean }>(`/auth/trusted-devices/${id}`, { method: 'DELETE' }),

  revokeAllTrustedDevices: () =>
    request<{ success: boolean; revoked: number }>('/auth/trusted-devices', { method: 'DELETE' }),
}

export const emailVerificationApi = {
  getStatus: () => request<{ available: boolean }>('/auth/email/status'),

  sendVerification: (email?: string) =>
    request<{ sent: boolean; message: string }>('/auth/email/send-verification', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    }),

  verify: (token: string) =>
    request<{ verified: boolean; message: string; email: string }>('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  remove: () =>
    request<{ user: User }>('/auth/email', {
      method: 'DELETE',
    }),
}

export const passwordResetApi = {
  getStatus: () => request<{ available: boolean }>('/auth/password-reset/status'),

  request: (identifier: string) =>
    request<{ message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  confirm: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
}

export interface UploadResult {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

export const uploadsApi = {
  upload: async (file: File): Promise<{ upload: UploadResult }> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({
        error: { code: 'UPLOAD_FAILED', message: 'Upload failed' },
      }))
      throw new ApiException(
        data.error.code,
        data.error.message,
        response.status
      )
    }

    return response.json()
  },

  getUrl: (filename: string): string => `${API_BASE}/uploads/${filename}`,

  delete: (filename: string) =>
    request<void>(`/uploads/${filename}`, {
      method: 'DELETE',
    }),
}

export { request }
