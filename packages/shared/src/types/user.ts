export type Language = 'en' | 'fr'
export type UserRole = 'user' | 'admin'

export interface UserPreferences {
  theme: 'light' | 'dark'
  darkThemeBase: string
  lightThemeBase: string
  accentColor: string
  avatarColor: string
  editorFontSize: string
  editorFontFamily: string
  sidebarCollapsed: boolean
  sidebarWidth: number
  tagsCollapsed: boolean
  tagsSectionHeight: number
  sharedCollapsed: boolean
  sharedSectionHeight: number
}

export interface User {
  id: string
  username: string
  name: string
  email?: string
  emailVerified: boolean
  avatarUrl?: string
  avatarColor: string
  role: UserRole
  isDisabled: boolean
  twoFactorEnabled: boolean
  trackingEnabled: boolean
  language: Language
  // Preferences
  theme: 'light' | 'dark'
  darkThemeBase: string
  lightThemeBase: string
  accentColor: string
  editorFontSize: string
  editorFontFamily: string
  sidebarCollapsed: boolean
  sidebarWidth: number
  tagsCollapsed: boolean
  tagsSectionHeight: number
  sharedCollapsed: boolean
  sharedSectionHeight: number
  onboardingCompleted: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface UserCreateInput {
  username: string
  password: string
  name?: string
  email?: string
}

export interface UserLoginInput {
  username: string
  password: string
}

export interface UserUpdateInput {
  username?: string
  name?: string
  avatarUrl?: string
  avatarColor?: string
  language?: Language
}
