import { useEffect, useState, useRef } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { preloadAllFonts } from '@/utils/fontLoader'
import {
  IoCloseOutline,
  IoShieldCheckmarkOutline,
  IoColorPaletteOutline,
  IoTrashOutline,
  IoRefreshOutline,
  IoReloadOutline,
  IoInformationCircleOutline,
  IoTextOutline,
  IoStatsChartOutline,
  IoSunnyOutline,
  IoMoonOutline,
  IoDocumentTextOutline,
  IoLogoGithub,
  IoPlayOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings'
import {
  useThemeStore,
  EDITOR_FONT_SIZES,
  EDITOR_FONT_FAMILIES,
  ACCENT_COLORS,
} from '@/stores/theme'
import { useStatsStore } from '@/stores/stats'
import { useFoldersStore } from '@/stores/folders'
import { toast } from '@/components/ui/Toast'
import { notesApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { setLanguageWithServer, getCurrentLanguage } from '@/i18n'
import { ConfirmDialog, StatsPanel } from '@/components/features'
import { replayOnboarding } from '@/components/features/OnboardingModal'
import { ThemeBasePicker } from '@/components/ui/ThemeBasePicker'
import type { Note, Language } from '@onyka/shared'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'appearance' | 'editor' | 'data' | 'security' | 'about'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const { settings, isLoading, fetchSettings, updateSettings } = useSettingsStore()
  const {
    theme,
    toggleTheme,
    accentColor,
    setAccentColor,
    editorFontSize,
    setEditorFontSize,
    editorFontFamily,
    setEditorFontFamily,
  } = useThemeStore()
  const { trackingEnabled, trackingLoaded, fetchTrackingEnabled, setTrackingEnabled } = useStatsStore()
  const { fetchFolderTree } = useFoldersStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [direction, setDirection] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [currentLang, setCurrentLang] = useState<Language>(getCurrentLanguage())
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false)

  const [deletedNotes, setDeletedNotes] = useState<Note[]>([])
  const [isLoadingTrash, setIsLoadingTrash] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false)
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false)
  const [showDisableTrackingDialog, setShowDisableTrackingDialog] = useState(false)

  const tabs: { id: SettingsTab; icon: React.ElementType; label: string }[] = [
    { id: 'appearance', icon: IoColorPaletteOutline, label: t('settings.tabs.appearance') },
    { id: 'editor', icon: IoDocumentTextOutline, label: t('settings.tabs.editor') },
    { id: 'data', icon: IoStatsChartOutline, label: t('settings.tabs.data') },
    ...(isAdmin ? [{ id: 'security' as const, icon: IoShieldCheckmarkOutline, label: t('settings.tabs.security') }] : []),
    { id: 'about', icon: IoInformationCircleOutline, label: t('settings.tabs.about') },
  ]

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      fetchDeletedNotes()
      fetchTrackingEnabled()
    }
  }, [isOpen, fetchSettings, fetchTrackingEnabled])

  useEffect(() => {
    if (!tabsRef.current) return
    const activeButton = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement
    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      })
    }
  }, [activeTab, isOpen])

  const handleTabChange = (newTab: SettingsTab) => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab)
    const newIndex = tabs.findIndex((t) => t.id === newTab)
    setDirection(newIndex > currentIndex ? 1 : -1)
    setActiveTab(newTab)
    if (newTab === 'editor') preloadAllFonts()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const fetchDeletedNotes = async () => {
    setIsLoadingTrash(true)
    try {
      const { notes } = await notesApi.list({ deleted: true })
      setDeletedNotes(notes)
    } catch {
      // Silently fail
    } finally {
      setIsLoadingTrash(false)
    }
  }

  const handleRestoreNote = async (noteId: string) => {
    const noteToRestore = deletedNotes.find((n) => n.id === noteId)
    setDeletedNotes((prev) => prev.filter((n) => n.id !== noteId))
    setRestoringId(noteId)

    try {
      await notesApi.restore(noteId)
      fetchFolderTree()
      toast.success(t('settings.trash.restored'))
    } catch {
      if (noteToRestore) {
        setDeletedNotes((prev) => [...prev, noteToRestore])
      }
      toast.error(t('settings.trash.restore_error'))
    } finally {
      setRestoringId(null)
    }
  }

  const handleEmptyTrash = async () => {
    setIsEmptyingTrash(true)
    try {
      await Promise.all(deletedNotes.map((note) => notesApi.delete(note.id)))
      setDeletedNotes([])
      setShowEmptyTrashDialog(false)
      toast.success(t('settings.trash.emptied'))
    } catch {
      toast.error(t('settings.trash.empty_error'))
    } finally {
      setIsEmptyingTrash(false)
    }
  }

  const getDaysRemaining = (deletedAt: Date | null) => {
    if (!deletedAt) return 30
    const deleted = deletedAt instanceof Date ? deletedAt : new Date(deletedAt)
    const now = new Date()
    const diffMs = 30 * 24 * 60 * 60 * 1000 - (now.getTime() - deleted.getTime())
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
  }

  const handleToggle = async (key: 'authDisabled' | 'allowRegistration', value: boolean) => {
    try {
      await updateSettings({ [key]: value })
      await fetchSettings()
      toast.success(t('settings.updated'))
    } catch {
      toast.error(t('settings.update_failed'))
    }
  }

  const handleTrackingToggle = (enabled: boolean) => {
    if (!enabled) {
      setShowDisableTrackingDialog(true)
    } else {
      performTrackingToggle(true)
    }
  }

  const performTrackingToggle = async (enabled: boolean) => {
    setIsUpdatingTracking(true)
    try {
      await setTrackingEnabled(enabled)
      toast.success(t('settings.updated'))
    } catch {
      toast.error(t('stats.tracking_error'))
    } finally {
      setIsUpdatingTracking(false)
      setShowDisableTrackingDialog(false)
    }
  }

  if (!isOpen) return null

  const contentVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 24 : -24,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -24 : 24,
      opacity: 0,
    }),
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.title')}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden pointer-events-auto animate-scale-in flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)] flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)]">
              {t('settings.title')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1.5 sm:p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={tabsRef}
            className="relative flex gap-0.5 sm:gap-1 px-2 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex-shrink-0 overflow-x-auto scrollbar-none"
          >
            <motion.div
              className="absolute bottom-2 sm:bottom-3 h-8 sm:h-9 rounded-lg bg-[var(--color-accent)] shadow-md"
              initial={false}
              animate={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
              }}
            />
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative z-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[380px] sm:min-h-[480px] max-h-[75vh] sm:max-h-[600px] relative overflow-hidden">
            {isLoading && !settings ? (
              <div className="flex items-center justify-center py-12">
                <IoReloadOutline className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
              </div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4 sm:p-6">

                    <div className="space-y-4">

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('settings.theme')}</p>
                          <div className="flex p-1 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <button
                              onClick={() => theme === 'dark' && toggleTheme()}
                              aria-label={t('settings.theme_light')}
                              className={`p-1.5 rounded-md transition-all duration-150 ${
                                theme === 'light'
                                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
                                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                              }`}
                            >
                              <IoSunnyOutline className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => theme === 'light' && toggleTheme()}
                              aria-label={t('settings.theme_dark')}
                              className={`p-1.5 rounded-md transition-all duration-150 ${
                                theme === 'dark'
                                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
                                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                              }`}
                            >
                              <IoMoonOutline className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <ThemeBasePicker />
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{t('settings.accent_color')}</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {ACCENT_COLORS.map((color) => {
                            const isSelected = accentColor === color.id
                            const colorValue = theme === 'dark' ? color.dark : color.light
                            return (
                              <button
                                key={color.id}
                                onClick={() => setAccentColor(color.id)}
                                className={`
                                  w-7 h-7 rounded-full transition-all duration-150
                                  ${isSelected
                                    ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-secondary)]'
                                    : 'hover:scale-110'
                                  }
                                `}
                                style={{
                                  backgroundColor: colorValue,
                                  ...(isSelected && { boxShadow: `0 0 0 2px ${colorValue}` }),
                                }}
                                title={color.name}
                                aria-label={color.name}
                              />
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('settings.language')}</p>
                          <div className="flex p-1 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <button
                              onClick={() => {
                                setLanguageWithServer('fr')
                                setCurrentLang('fr')
                              }}
                              className={`px-3 py-1.5 rounded-md text-sm transition-all duration-150 ${
                                currentLang === 'fr'
                                  ? 'bg-[var(--color-bg-primary)] shadow-sm'
                                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                              }`}
                            >
                              🇫🇷
                            </button>
                            <button
                              onClick={() => {
                                setLanguageWithServer('en')
                                setCurrentLang('en')
                              }}
                              className={`px-3 py-1.5 rounded-md text-sm transition-all duration-150 ${
                                currentLang === 'en'
                                  ? 'bg-[var(--color-bg-primary)] shadow-sm'
                                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                              }`}
                            >
                              🇬🇧
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

                {activeTab === 'editor' && (
                  <motion.div
                    key="editor"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <SettingSection
                      title={t('settings.font_size')}
                      description={t('settings.font_size_desc')}
                      icon={IoTextOutline}
                    >
                      <div className="flex gap-2">
                        {EDITOR_FONT_SIZES.map((size) => (
                          <button
                            key={size.id}
                            onClick={() => setEditorFontSize(size.id)}
                            className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              editorFontSize === size.id
                                ? 'bg-[var(--color-accent)] text-white'
                                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                            }`}
                          >
                            {t(`settings.font_sizes.${size.id.toLowerCase()}`)}
                          </button>
                        ))}
                      </div>
                    </SettingSection>

                    <SettingSection
                      title={t('settings.font_family')}
                      description={t('settings.font_family_desc')}
                      icon={IoDocumentTextOutline}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {EDITOR_FONT_FAMILIES.map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setEditorFontFamily(font.id)}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                              editorFontFamily === font.id
                                ? 'bg-[var(--color-accent)] text-white'
                                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                            }`}
                            style={{ fontFamily: font.family }}
                          >
                            {font.name}
                          </button>
                        ))}
                      </div>
                    </SettingSection>
                  </motion.div>
                )}

                {activeTab === 'data' && (
                  <motion.div
                    key="data"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <SettingRow
                      title={t('stats.tracking')}
                      description={t('stats.tracking_desc')}
                      icon={IoStatsChartOutline}
                    >
                      <ToggleSwitch
                        checked={trackingEnabled}
                        onChange={handleTrackingToggle}
                        disabled={!trackingLoaded || isUpdatingTracking}
                      />
                    </SettingRow>

                    {trackingEnabled && <StatsPanel />}

                    <SettingSection
                      title={t('settings.trash.title')}
                      description={t('settings.trash.description')}
                      icon={IoTrashOutline}
                      action={
                        deletedNotes.length > 0 ? (
                          <button
                            onClick={() => setShowEmptyTrashDialog(true)}
                            className="text-sm text-[var(--color-error)] hover:text-[var(--color-error)]/80 transition-colors"
                          >
                            {t('settings.trash.empty')}
                          </button>
                        ) : undefined
                      }
                    >
                      <div className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
                        {isLoadingTrash ? (
                          <div className="flex items-center justify-center py-8">
                            <IoReloadOutline className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
                          </div>
                        ) : deletedNotes.length === 0 ? (
                          <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                            <IoTrashOutline className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('settings.trash.empty_state')}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-[var(--color-border-subtle)] max-h-48 overflow-y-auto">
                            {deletedNotes.map((note) => (
                              <div
                                key={note.id}
                                className="flex items-center justify-between gap-2 p-3 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[var(--color-text-primary)] truncate text-sm">
                                    {note.title || t('editor.untitled')}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-tertiary)]">
                                    {t('settings.trash.days_remaining', { n: getDaysRemaining(note.deletedAt) })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRestoreNote(note.id)}
                                  disabled={restoringId === note.id}
                                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                                >
                                  {restoringId === note.id ? (
                                    <IoReloadOutline className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <IoRefreshOutline className="w-4 h-4" />
                                  )}
                                  <span className="hidden sm:inline">{t('settings.trash.restore')}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SettingSection>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div
                    key="security"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <SettingRow
                      title={t('settings.authentication.disable')}
                      description={t('settings.authentication.disable_desc')}
                      icon={IoShieldCheckmarkOutline}
                    >
                      <ToggleSwitch
                        checked={settings?.authDisabled ?? false}
                        onChange={(checked) => handleToggle('authDisabled', checked)}
                      />
                    </SettingRow>

                    <SettingRow
                      title={t('settings.authentication.allow_registration')}
                      description={t('settings.authentication.allow_registration_desc')}
                      icon={IoShieldCheckmarkOutline}
                    >
                      <ToggleSwitch
                        checked={settings?.allowRegistration ?? true}
                        onChange={(checked) => handleToggle('allowRegistration', checked)}
                        disabled={settings?.authDisabled}
                      />
                    </SettingRow>
                  </motion.div>
                )}

                {activeTab === 'about' && (
                  <motion.div
                    key="about"
                    custom={direction}
                    variants={contentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div className="text-center py-6">
                      <OnykaLogo className="w-14 h-14 mx-auto mb-3 logo-glow" />
                      <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-0.5">
                        {settings?.appName ?? 'Onyka'}
                      </h3>
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)] tracking-wide">
                        {t('settings.about.version', { version: '1.0.1' })}
                      </p>
                    </div>

                    <p className="text-sm text-[var(--color-text-secondary)] text-center leading-relaxed px-4">
                      {t('settings.about.description')}
                    </p>

                    <div className="flex justify-center gap-2">
                      <a
                        href="https://github.com/karl-cta/onyka"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <IoLogoGithub className="w-4 h-4" />
                        GitHub
                      </a>
                      <button
                        onClick={() => {
                          replayOnboarding()
                          onClose()
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <IoPlayOutline className="w-4 h-4" />
                        {t('onboarding.replay')}
                      </button>
                    </div>

                    <div className="text-center text-xs text-[var(--color-text-tertiary)] pt-2 space-y-0.5">
                      <p>{t('settings.about.license')}</p>
                      <p>{t('settings.about.made_with')}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showEmptyTrashDialog}
        onClose={() => setShowEmptyTrashDialog(false)}
        onConfirm={handleEmptyTrash}
        title={t('settings.trash.empty_confirm_title')}
        message={t('settings.trash.empty_confirm_message', { count: deletedNotes.length })}
        confirmLabel={t('settings.trash.empty')}
        isLoading={isEmptyingTrash}
      />

      <ConfirmDialog
        isOpen={showDisableTrackingDialog}
        onClose={() => setShowDisableTrackingDialog(false)}
        onConfirm={() => performTrackingToggle(false)}
        title={t('stats.disable_title')}
        message={t('stats.disable_message')}
        confirmLabel={t('stats.disable_confirm')}
        variant="danger"
        isLoading={isUpdatingTracking}
      />
    </>,
    document.body
  )
}

function SettingSection({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string
  description?: string
  icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
            {description && <p className="text-sm text-[var(--color-text-tertiary)]">{description}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

function SettingRow({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[var(--color-bg-secondary)] rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-primary)]">{title}</p>
          {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0 self-end sm:self-center">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 flex-shrink-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]'
          : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full shadow-md transition-all duration-200 ${
          checked ? 'translate-x-6 bg-white' : 'translate-x-0.5 bg-[var(--color-text-tertiary)]'
        }`}
      />
    </button>
  )
}
