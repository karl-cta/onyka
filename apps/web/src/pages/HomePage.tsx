import { useState, useEffect, useCallback } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { useTranslation } from 'react-i18next'
import { Sidebar, SearchDialog, MobileHeader } from '@/components/layout'
import { NoteEditor } from '@/components/editor'
import { WeeklyRecapModal } from '@/components/features/WeeklyRecapModal'
import { SparksDrawer } from '@/components/features/SparksDrawer'
import { SparkQuickAdd } from '@/components/features/SparkQuickAdd'
import { OnboardingModal, useOnboarding } from '@/components/features/OnboardingModal'
import { useAuthStore } from '@/stores/auth'
import { useNotesStore } from '@/stores/notes'
import { useFoldersStore } from '@/stores/folders'
import { useThemeStore } from '@/stores/theme'
import { useRecapsStore } from '@/stores/recaps'
import { useStatsStore } from '@/stores/stats'
import { useSparksStore } from '@/stores/sparks'
import { useSharesStore } from '@/stores/shares'
import { useIsMobile, useShareNotifications } from '@/hooks'
import { toast } from '@/components/ui/Toast'
import { IoAddOutline } from 'react-icons/io5'
import { SparkIcon } from '@/components/ui'
import type { NoteUpdateInput } from '@onyka/shared'

export function HomePage() {
  const { t } = useTranslation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const { currentNote, fetchNote, updateNote, setCurrentNote, deleteNote } = useNotesStore()
  const { fetchFolderTree, triggerNewNoteInput } = useFoldersStore()
  const { focusMode, toggleFocusMode, openMobileSidebar, closeMobileSidebar } = useThemeStore()
  const { pendingRecap, fetchPendingRecap, dismissRecap, isRecapModalOpen, openRecapModal } = useRecapsStore()
  const { trackingEnabled } = useStatsStore()
  const { openQuickAdd: openSparkQuickAdd } = useSparksStore()
  const { fetchSharedWithMe } = useSharesStore()
  const isMobile = useIsMobile()
  const { user } = useAuthStore()
  const { isOpen: isOnboardingOpen, close: closeOnboardingBase } = useOnboarding(user?.id, user?.onboardingCompleted)
  const closeOnboarding = useCallback(() => {
    closeOnboardingBase()
    closeMobileSidebar()
  }, [closeOnboardingBase, closeMobileSidebar])

  useShareNotifications({
    onShareReceived: (notification) => {
      toast.info(
        t('share.notification_title', 'New share'),
        t('share.notification_body', '{{name}} shared "{{title}}" with you', {
          name: notification.sharedBy.name || notification.sharedBy.username,
          title: notification.resourceTitle,
        })
      )
      fetchSharedWithMe()
    },
  })

  const handleNewNote = useCallback(() => {
    triggerNewNoteInput()
    if (isMobile) {
      openMobileSidebar()
    }
  }, [triggerNewNoteInput, isMobile, openMobileSidebar])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        toggleFocusMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode])

  useEffect(() => {
    if (trackingEnabled) {
      fetchPendingRecap()
    }
  }, [trackingEnabled, fetchPendingRecap])

  useEffect(() => {
    if (pendingRecap && trackingEnabled && !isRecapModalOpen) {
      const timer = setTimeout(() => {
        openRecapModal()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [pendingRecap, trackingEnabled, isRecapModalOpen, openRecapModal])

  useEffect(() => {
    if (selectedNoteId) {
      fetchNote(selectedNoteId)
    } else {
      setCurrentNote(null)
    }
  }, [selectedNoteId, fetchNote, setCurrentNote])

  const handleUpdateNote = useCallback(
    async (updates: NoteUpdateInput) => {
      if (currentNote) {
        await updateNote(currentNote.id, updates)
        if (updates.title !== undefined) {
          fetchFolderTree()
        }
      }
    },
    [currentNote, updateNote, fetchFolderTree]
  )

  const handleDeleteNote = useCallback(async () => {
    if (currentNote) {
      await deleteNote(currentNote.id)
      setSelectedNoteId(null)
      fetchFolderTree()
    }
  }, [currentNote, deleteNote, fetchFolderTree])

  return (
    <div className={`h-screen flex flex-col md:flex-row bg-[var(--color-bg-primary)] transition-all duration-300 ${focusMode ? 'p-0' : 'p-2 gap-2 md:p-3 md:gap-3'}`}>
      {!focusMode && (
        <MobileHeader
          onOpenSidebar={openMobileSidebar}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      {!focusMode && (
        <Sidebar
          onOpenSearch={() => setIsSearchOpen(true)}
          onSelectNote={setSelectedNoteId}
          selectedNoteId={selectedNoteId}
        />
      )}

      <main
        className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-500 ease-out ${
          focusMode
            ? 'bg-[var(--color-bg-primary)] max-w-4xl w-full mx-auto px-4'
            : 'bg-[var(--color-bg-secondary)] rounded-xl md:rounded-2xl border border-[var(--color-border-subtle)] shadow-lg mt-16 md:mt-0'
        }`}
        role="main"
        aria-label="Note content"
      >
        {currentNote ? (
          <NoteEditor note={currentNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
            {/* Decorative glow — hidden on mobile (blur-3xl expensive on WebKit) */}
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] md:w-[600px] md:h-[400px] rounded-full opacity-20 hidden md:block md:blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, var(--color-accent) 0%, transparent 60%)' }}
            />

            <div className="text-center relative z-10 animate-blur-in max-w-md px-4">
              <div className="relative w-24 h-24 md:w-36 md:h-36 mx-auto mb-6 md:mb-8">
                {/* Glow logo — hidden on mobile (blur-2xl + infinite animation expensive on WebKit) */}
                <OnykaLogo
                  className="absolute inset-0 w-full h-full hidden md:block md:blur-2xl opacity-80 animate-pulse-glow scale-150"
                />
                <OnykaLogo
                  className="absolute inset-0 w-full h-full"
                />
              </div>

              <h1 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                {t('home.start_writing')}
              </h1>
              <p className="text-xs md:text-sm text-[var(--color-text-secondary)] mb-6 md:mb-8">
                {t('home.empty_message')}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                <button
                  onClick={handleNewNote}
                  className="fold-button group w-full sm:w-auto"
                >
                  <span className="fold-corner" />
                  <span className="fold-button-inner">
                    <IoAddOutline className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
                    <span>{t('sidebar.new_note')}</span>
                  </span>
                </button>

                <button
                  onClick={openSparkQuickAdd}
                  className="spark-button group w-full sm:w-auto"
                >
                  <span className="spark-button-bg" />
                  <span className="spark-button-inner">
                    <span className="spark-icon-wrapper">
                      <SparkIcon className="w-4 h-4 text-[var(--color-accent)]" />
                    </span>
                    <span>{t('sparks.title')}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNote={(id) => {
          setSelectedNoteId(id)
          setIsSearchOpen(false)
        }}
      />

      {pendingRecap && (
        <WeeklyRecapModal
          isOpen={isRecapModalOpen}
          recap={pendingRecap}
          onDismiss={() => dismissRecap(pendingRecap.id)}
        />
      )}

      <SparksDrawer />
      <SparkQuickAdd />

      <OnboardingModal isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {focusMode && !isMobile && (
        <button
          onClick={openSparkQuickAdd}
          className="fixed bottom-6 right-6 p-3.5 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 z-30"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 80%, #000) 100%)',
            boxShadow: '0 8px 32px -4px var(--color-accent-glow)',
          }}
          title={t('sparks.title')}
        >
          <SparkIcon className="w-5 h-5" animated />
        </button>
      )}

      {/* Mobile FABs removed — sidebar already has Sparks + New Note buttons */}
    </div>
  )
}
