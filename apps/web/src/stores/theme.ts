import { create } from 'zustand'
import type { User } from '@onyka/shared'
import { usersApi } from '../services/api'
import { loadFont } from '../utils/fontLoader'

// Breaks circular dependency between auth and theme stores
let _isAuthenticated = false

/** Called by auth store when authentication state changes. */
export function setAuthenticatedState(authenticated: boolean): void {
  _isAuthenticated = authenticated
}

const isUserAuthenticated = () => _isAuthenticated

const safeUpdatePreferences = (prefs: Parameters<typeof usersApi.updatePreferences>[0]) => {
  if (isUserAuthenticated()) {
    usersApi.updatePreferences(prefs).catch(() => {})
  }
}

type Theme = 'light' | 'dark'

export type ThemeBase =
  | 'default'
  | 'dracula'
  | 'nord'
  | 'tokyo-night'
  | 'one-dark'
  | 'github'
  | 'catppuccin-latte'
  | 'rose-pine-dawn'
  | 'paper'

export const THEME_BASES: {
  id: ThemeBase
  name: string
  mode: 'dark' | 'light'
  preview: { bg: string; text: string; accent: string }
}[] = [
  { id: 'default', name: 'Default', mode: 'dark', preview: { bg: '#0A0A0F', text: '#F5F5F5', accent: '#D97706' } },
  { id: 'dracula', name: 'Dracula', mode: 'dark', preview: { bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' } },
  { id: 'nord', name: 'Nord', mode: 'dark', preview: { bg: '#2e3440', text: '#eceff4', accent: '#88c0d0' } },
  { id: 'tokyo-night', name: 'Tokyo Night', mode: 'dark', preview: { bg: '#1a1b26', text: '#c0caf5', accent: '#7aa2f7' } },
  { id: 'one-dark', name: 'One Dark', mode: 'dark', preview: { bg: '#282c34', text: '#abb2bf', accent: '#61afef' } },
  { id: 'default', name: 'Default', mode: 'light', preview: { bg: '#FFFFFF', text: '#0F172A', accent: '#F59E0B' } },
  { id: 'github', name: 'GitHub', mode: 'light', preview: { bg: '#ffffff', text: '#1f2328', accent: '#0969da' } },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', mode: 'light', preview: { bg: '#eff1f5', text: '#4c4f69', accent: '#8839ef' } },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', mode: 'light', preview: { bg: '#faf4ed', text: '#575279', accent: '#d7827e' } },
  { id: 'paper', name: 'Paper', mode: 'light', preview: { bg: '#f5f5f0', text: '#2c2c2c', accent: '#555555' } },
]

export type EditorFontSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type EditorFontFamily =
  | 'inter'
  | 'georgia'
  | 'montserrat'
  | 'fira-code'
  | 'crimson-pro'
  | 'nunito'
  | 'plus-jakarta-sans'
  | 'space-grotesk'
  | 'ibm-plex-serif'
  | 'courier-prime'
  | 'lexend'
  | 'eb-garamond'

export const EDITOR_FONT_SIZES: { id: EditorFontSize; size: number }[] = [
  { id: 'XS', size: 14 },
  { id: 'S', size: 16 },
  { id: 'M', size: 18 },
  { id: 'L', size: 22 },
  { id: 'XL', size: 28 },
  { id: 'XXL', size: 36 },
]

export const EDITOR_FONT_FAMILIES: { id: EditorFontFamily; name: string; family: string }[] = [
  { id: 'courier-prime', name: 'Courier Prime', family: '"Courier Prime", monospace' },
  { id: 'crimson-pro', name: 'Crimson Pro', family: '"Crimson Pro", serif' },
  { id: 'eb-garamond', name: 'EB Garamond', family: '"EB Garamond", serif' },
  { id: 'fira-code', name: 'Fira Code', family: '"Fira Code", monospace' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, serif' },
  { id: 'ibm-plex-serif', name: 'IBM Plex Serif', family: '"IBM Plex Serif", serif' },
  { id: 'inter', name: 'Inter', family: '"Inter", sans-serif' },
  { id: 'lexend', name: 'Lexend', family: '"Lexend", sans-serif' },
  { id: 'montserrat', name: 'Montserrat', family: '"Montserrat", sans-serif' },
  { id: 'nunito', name: 'Nunito', family: '"Nunito", sans-serif' },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", sans-serif' },
]

export type AccentColor =
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'pink'
  | 'red'
  | 'orange'
  | 'amber'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'slate'
  | 'zinc'

export const ACCENT_COLORS: {
  id: AccentColor
  name: string
  light: string
  dark: string
}[] = [
  { id: 'blue', name: 'Bleu', light: '#3B82F6', dark: '#2563EB' },
  { id: 'indigo', name: 'Indigo', light: '#6366F1', dark: '#4F46E5' },
  { id: 'violet', name: 'Violet', light: '#8B5CF6', dark: '#7C3AED' },
  { id: 'fuchsia', name: 'Fuchsia', light: '#D946EF', dark: '#C026D3' },
  { id: 'pink', name: 'Rose', light: '#EC4899', dark: '#DB2777' },
  { id: 'red', name: 'Rouge', light: '#EF4444', dark: '#DC2626' },
  { id: 'orange', name: 'Orange', light: '#F97316', dark: '#EA580C' },
  { id: 'amber', name: 'Ambre', light: '#F59E0B', dark: '#D97706' },
  { id: 'lime', name: 'Lime', light: '#84CC16', dark: '#65A30D' },
  { id: 'green', name: 'Vert', light: '#22C55E', dark: '#16A34A' },
  { id: 'teal', name: 'Sarcelle', light: '#14B8A6', dark: '#0D9488' },
  { id: 'cyan', name: 'Cyan', light: '#06B6D4', dark: '#0891B2' },
  { id: 'sky', name: 'Ciel', light: '#0EA5E9', dark: '#0284C7' },
  { id: 'slate', name: 'Ardoise', light: '#64748B', dark: '#475569' },
  { id: 'zinc', name: 'Zinc', light: '#71717A', dark: '#52525B' },
]

let sidebarWidthTimeout: ReturnType<typeof setTimeout> | null = null
const SIDEBAR_WIDTH_DEBOUNCE_MS = 500

// --- localStorage persistence for theme (survives logout + refresh) ---
const LS_KEY = 'onyka-theme'

interface PersistedTheme {
  theme: Theme
  darkThemeBase: ThemeBase
  lightThemeBase: ThemeBase
  accentColor: AccentColor
}

function loadPersistedTheme(): Partial<PersistedTheme> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PersistedTheme
  } catch {
    return {}
  }
}

function persistTheme(data: PersistedTheme): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch { /* quota exceeded — ignore */ }
}

// Restore persisted values (or use defaults)
const _persisted = loadPersistedTheme()
const _initTheme: Theme = _persisted.theme ?? 'dark'
const _initDarkBase: ThemeBase = _persisted.darkThemeBase ?? 'default'
const _initLightBase: ThemeBase = _persisted.lightThemeBase ?? 'default'
const _initAccent: AccentColor = _persisted.accentColor ?? 'amber'

interface ThemeState {
  theme: Theme
  darkThemeBase: ThemeBase
  lightThemeBase: ThemeBase
  accentColor: AccentColor
  editorFontSize: EditorFontSize
  editorFontFamily: EditorFontFamily
  focusMode: boolean
  sidebarCollapsed: boolean
  sidebarWidth: number
  tagsCollapsed: boolean
  tagsSectionHeight: number
  sharedCollapsed: boolean
  sharedSectionHeight: number
  mobileSidebarOpen: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setThemeBase: (themeBase: ThemeBase) => void
  setDarkThemeBase: (themeBase: ThemeBase) => void
  setLightThemeBase: (themeBase: ThemeBase) => void
  setAccentColor: (color: AccentColor) => void
  setEditorFontSize: (size: EditorFontSize) => void
  setEditorFontFamily: (family: EditorFontFamily) => void
  toggleFocusMode: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarWidth: (width: number) => void
  toggleTagsCollapsed: () => void
  setTagsSectionHeight: (height: number) => void
  toggleSharedCollapsed: () => void
  setSharedSectionHeight: (height: number) => void
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  toggleMobileSidebar: () => void
  getCurrentThemeBase: () => ThemeBase
  loadFromUser: (user: User) => Promise<void>
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: _initTheme,
  darkThemeBase: _initDarkBase,
  lightThemeBase: _initLightBase,
  accentColor: _initAccent,
  editorFontSize: 'S',
  editorFontFamily: 'plus-jakarta-sans',
  focusMode: false,
  sidebarCollapsed: false,
  sidebarWidth: 288,
  tagsCollapsed: false,
  tagsSectionHeight: 120,
  sharedCollapsed: false,
  sharedSectionHeight: 150,
  mobileSidebarOpen: false,

  getCurrentThemeBase: () => {
    const { theme, darkThemeBase, lightThemeBase } = get()
    return theme === 'dark' ? darkThemeBase : lightThemeBase
  },

  loadFromUser: async (user: User) => {
    const theme = user.theme as Theme
    const darkThemeBase = (user.darkThemeBase || 'default') as ThemeBase
    const lightThemeBase = (user.lightThemeBase || 'default') as ThemeBase
    const accentColor = (user.accentColor || 'amber') as AccentColor
    const editorFontSize = (user.editorFontSize || 'S') as EditorFontSize
    const editorFontFamily = (user.editorFontFamily || 'plus-jakarta-sans') as EditorFontFamily
    const sidebarCollapsed = user.sidebarCollapsed ?? false
    const sidebarWidth = user.sidebarWidth ?? 288
    const tagsCollapsed = user.tagsCollapsed ?? false
    const tagsSectionHeight = user.tagsSectionHeight ?? 120
    const sharedCollapsed = user.sharedCollapsed ?? false
    const sharedSectionHeight = user.sharedSectionHeight ?? 150

    // Load the user's preferred font BEFORE applying theme (prevents FOUT)
    await loadFont(editorFontFamily)

    set({
      theme,
      darkThemeBase,
      lightThemeBase,
      accentColor,
      editorFontSize,
      editorFontFamily,
      sidebarCollapsed,
      sidebarWidth,
      tagsCollapsed,
      tagsSectionHeight,
      sharedCollapsed,
      sharedSectionHeight,
    })

    const themeBase = theme === 'dark' ? darkThemeBase : lightThemeBase
    updateDocumentTheme(theme, themeBase, accentColor, editorFontSize, editorFontFamily)
    persistTheme({ theme, darkThemeBase, lightThemeBase, accentColor })
  },

  setTheme: (theme) => {
    set({ theme })
    const themeBase = theme === 'dark' ? get().darkThemeBase : get().lightThemeBase
    updateDocumentTheme(theme, themeBase, get().accentColor, get().editorFontSize, get().editorFontFamily)
    persistTheme({ theme, darkThemeBase: get().darkThemeBase, lightThemeBase: get().lightThemeBase, accentColor: get().accentColor })
    safeUpdatePreferences({ theme })
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    const themeBase = newTheme === 'dark' ? get().darkThemeBase : get().lightThemeBase
    set({ theme: newTheme })
    updateDocumentTheme(newTheme, themeBase, get().accentColor, get().editorFontSize, get().editorFontFamily)
    persistTheme({ theme: newTheme, darkThemeBase: get().darkThemeBase, lightThemeBase: get().lightThemeBase, accentColor: get().accentColor })
    safeUpdatePreferences({ theme: newTheme })
  },

  setThemeBase: (themeBase) => {
    const { theme } = get()
    if (theme === 'dark') {
      set({ darkThemeBase: themeBase })
      safeUpdatePreferences({ darkThemeBase: themeBase })
    } else {
      set({ lightThemeBase: themeBase })
      safeUpdatePreferences({ lightThemeBase: themeBase })
    }
    updateDocumentTheme(theme, themeBase, get().accentColor, get().editorFontSize, get().editorFontFamily)
    persistTheme({ theme, darkThemeBase: get().darkThemeBase, lightThemeBase: get().lightThemeBase, accentColor: get().accentColor })
  },

  setDarkThemeBase: (themeBase) => {
    set({ darkThemeBase: themeBase })
    const { theme } = get()
    if (theme === 'dark') {
      updateDocumentTheme(theme, themeBase, get().accentColor, get().editorFontSize, get().editorFontFamily)
    }
    persistTheme({ theme, darkThemeBase: themeBase, lightThemeBase: get().lightThemeBase, accentColor: get().accentColor })
    safeUpdatePreferences({ darkThemeBase: themeBase })
  },

  setLightThemeBase: (themeBase) => {
    set({ lightThemeBase: themeBase })
    const { theme } = get()
    if (theme === 'light') {
      updateDocumentTheme(theme, themeBase, get().accentColor, get().editorFontSize, get().editorFontFamily)
    }
    persistTheme({ theme, darkThemeBase: get().darkThemeBase, lightThemeBase: themeBase, accentColor: get().accentColor })
    safeUpdatePreferences({ lightThemeBase: themeBase })
  },

  setAccentColor: (accentColor) => {
    set({ accentColor })
    updateDocumentTheme(get().theme, get().getCurrentThemeBase(), accentColor, get().editorFontSize, get().editorFontFamily)
    persistTheme({ theme: get().theme, darkThemeBase: get().darkThemeBase, lightThemeBase: get().lightThemeBase, accentColor })
    safeUpdatePreferences({ accentColor })
  },

  setEditorFontSize: (editorFontSize) => {
    set({ editorFontSize })
    updateDocumentTheme(get().theme, get().getCurrentThemeBase(), get().accentColor, editorFontSize, get().editorFontFamily)
    safeUpdatePreferences({ editorFontSize })
  },

  setEditorFontFamily: (editorFontFamily) => {
    set({ editorFontFamily })
    updateDocumentTheme(get().theme, get().getCurrentThemeBase(), get().accentColor, get().editorFontSize, editorFontFamily)
    safeUpdatePreferences({ editorFontFamily })
  },

  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  toggleSidebar: () => {
    const newCollapsed = !get().sidebarCollapsed
    set({ sidebarCollapsed: newCollapsed })
    safeUpdatePreferences({ sidebarCollapsed: newCollapsed })
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    safeUpdatePreferences({ sidebarCollapsed: collapsed })
  },

  setSidebarWidth: (width) => {
    const clampedWidth = Math.min(Math.max(width, 240), 420)
    set({ sidebarWidth: clampedWidth })

    if (sidebarWidthTimeout) {
      clearTimeout(sidebarWidthTimeout)
    }
    sidebarWidthTimeout = setTimeout(() => {
      safeUpdatePreferences({ sidebarWidth: clampedWidth })
      sidebarWidthTimeout = null
    }, SIDEBAR_WIDTH_DEBOUNCE_MS)
  },

  toggleTagsCollapsed: () => {
    const newCollapsed = !get().tagsCollapsed
    set({ tagsCollapsed: newCollapsed })
    safeUpdatePreferences({ tagsCollapsed: newCollapsed })
  },

  setTagsSectionHeight: (height) => {
    const clampedHeight = Math.min(Math.max(height, 60), 300)
    set({ tagsSectionHeight: clampedHeight })

    if (sidebarWidthTimeout) {
      clearTimeout(sidebarWidthTimeout)
    }
    sidebarWidthTimeout = setTimeout(() => {
      safeUpdatePreferences({ tagsSectionHeight: clampedHeight })
      sidebarWidthTimeout = null
    }, SIDEBAR_WIDTH_DEBOUNCE_MS)
  },

  toggleSharedCollapsed: () => {
    const newCollapsed = !get().sharedCollapsed
    set({ sharedCollapsed: newCollapsed })
    safeUpdatePreferences({ sharedCollapsed: newCollapsed })
  },

  setSharedSectionHeight: (height) => {
    const clampedHeight = Math.min(Math.max(height, 60), 300)
    set({ sharedSectionHeight: clampedHeight })

    if (sidebarWidthTimeout) {
      clearTimeout(sidebarWidthTimeout)
    }
    sidebarWidthTimeout = setTimeout(() => {
      safeUpdatePreferences({ sharedSectionHeight: clampedHeight })
      sidebarWidthTimeout = null
    }, SIDEBAR_WIDTH_DEBOUNCE_MS)
  },

  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
}))

function updateDocumentTheme(
  theme: Theme,
  themeBase: ThemeBase,
  accentColor: AccentColor,
  editorFontSize: EditorFontSize = 'S',
  editorFontFamily: EditorFontFamily = 'plus-jakarta-sans'
) {
  const root = document.documentElement

  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  THEME_BASES.forEach(({ id }) => {
    if (id !== 'default') {
      root.classList.remove(`theme-${id}`)
    }
  })

  if (themeBase !== 'default') {
    root.classList.add(`theme-${themeBase}`)
  }

  ACCENT_COLORS.forEach(({ id }) => {
    root.classList.remove(`accent-${id}`)
  })

  root.classList.add(`accent-${accentColor}`)

  const fontSize = EDITOR_FONT_SIZES.find(s => s.id === editorFontSize)?.size ?? 16
  root.style.setProperty('--editor-font-size', `${fontSize}px`)

  const fontFamily = EDITOR_FONT_FAMILIES.find(f => f.id === editorFontFamily)?.family ?? '"Plus Jakarta Sans", sans-serif'
  root.style.setProperty('--editor-font-family', fontFamily)

  // Dynamically load the selected font (noop if already loaded)
  loadFont(editorFontFamily)
}

// Apply persisted theme immediately on module load (before auth check)
// This ensures the login page renders with the user's last theme.
{
  const initBase = _initTheme === 'dark' ? _initDarkBase : _initLightBase
  updateDocumentTheme(_initTheme, initBase, _initAccent)
}
