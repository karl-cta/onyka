// Default configuration values
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

// Permissions
export const PERMISSIONS = ['read', 'edit', 'admin'] as const

// Resource types
export const RESOURCE_TYPES = ['note', 'folder', 'workspace'] as const

// Export formats
export const EXPORT_FORMATS = ['md', 'txt', 'html', 'pdf'] as const

// Theme colors (dark mode)
export const THEME_COLORS = {
  dark: {
    bgPrimary: '#000000',
    bgSecondary: '#150050',
    bgTertiary: '#3F0071',
    accent: '#610094',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8B8B8',
    border: '#3F0071',
  },
  light: {
    bgPrimary: '#FAFAFA',
    bgSecondary: '#F0F0F5',
    bgTertiary: '#E8E8F0',
    accent: '#610094',
    textPrimary: '#1A1A2E',
    textSecondary: '#4A4A5A',
    border: '#D0D0E0',
  },
} as const

// Rate limiting
export const MAX_LOGIN_ATTEMPTS_USERNAME = 5
export const MAX_LOGIN_ATTEMPTS_IP = 20
export const LOCKOUT_DURATION_MINUTES = 15
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000

// Legacy alias for backwards compatibility
export const MAX_LOGIN_ATTEMPTS = MAX_LOGIN_ATTEMPTS_USERNAME

// Token expiry
export const ACCESS_TOKEN_EXPIRY = '15m'
export const REFRESH_TOKEN_EXPIRY_DAYS = 7

// Upload limits
export const MAX_UPLOAD_SIZE_MB = 10
