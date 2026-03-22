import { useState, useEffect, useCallback, useRef } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { useTranslation } from 'react-i18next'
import { Sidebar, MobileHeader } from '@/components/layout'
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
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { currentNote, fetchNote, updateNote, setCurrentNote, deleteNote } = useNotesStore()
  const { fetchFolderTree, triggerNewNoteInput } = useFoldersStore()
  const { focusMode, focusEditorWidth, setFocusEditorWidth, toggleFocusMode, openMobileSidebar, closeMobileSidebar } = useThemeStore()
  const [isResizingFocus, setIsResizingFocus] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
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
        searchInputRef.current?.focus()
      }
      if (e.code === 'Space' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        openSparkQuickAdd()
      }
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        toggleFocusMode()
      }
      if (focusMode && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key === '[') {
          e.preventDefault()
          setFocusEditorWidth(Math.max(40, focusEditorWidth - 10))
        }
        if (e.key === ']') {
          e.preventDefault()
          setFocusEditorWidth(Math.min(100, focusEditorWidth + 10))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode, focusMode, focusEditorWidth, setFocusEditorWidth, openSparkQuickAdd])

  useEffect(() => {
    if (!isResizingFocus) return
    let rafId = 0
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const center = window.innerWidth / 2
        const halfWidth = Math.abs(e.clientX - center)
        const newPercent = Math.round((halfWidth * 2) / window.innerWidth * 100)
        setFocusEditorWidth(Math.max(40, Math.min(100, newPercent)))
      })
    }
    const handleMouseUp = () => {
      cancelAnimationFrame(rafId)
      setIsResizingFocus(false)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingFocus, setFocusEditorWidth])

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
    <div className={`h-dvh flex flex-col md:flex-row bg-[var(--color-bg-primary)] overflow-hidden transition-all duration-500 ${focusMode ? 'p-0' : 'p-2 gap-2 md:p-3 md:gap-3'}`}>
      {!focusMode && (
        <MobileHeader
          onOpenSidebar={openMobileSidebar}
          onOpenSearch={() => { openMobileSidebar(); setTimeout(() => searchInputRef.current?.focus(), 300) }}
        />
      )}

      <Sidebar
        onSelectNote={setSelectedNoteId}
        selectedNoteId={selectedNoteId}
        searchInputRef={searchInputRef}
      />

      <main
        ref={mainRef}
        className={`flex-1 flex flex-col overflow-hidden relative ${
          isResizingFocus ? '' : 'transition-all duration-500 ease-out'
        } ${
          focusMode
            ? 'bg-[var(--color-bg-primary)] w-full mx-auto border border-transparent shadow-none'
            : 'bg-[var(--color-bg-secondary)] rounded-xl md:rounded-2xl border border-[var(--color-border-subtle)] shadow-lg mt-14 md:mt-0'
        }`}
        style={focusMode ? { maxWidth: `${focusEditorWidth}%` } : undefined}
        role="main"
        aria-label="Note content"
      >
        {focusMode && (
          <>
            {isResizingFocus && (
              <div className="fixed inset-0 z-40 cursor-col-resize" />
            )}
            <div
              onMouseDown={(e) => { e.preventDefault(); setIsResizingFocus(true) }}
              className="absolute top-0 -left-2 w-4 h-full cursor-col-resize z-30 group flex items-center justify-center"
            >
              <div className={`w-0.5 h-10 rounded-full transition-all duration-200 ${
                isResizingFocus
                  ? 'bg-[var(--color-accent)] opacity-80 h-16'
                  : 'bg-[var(--color-border)] opacity-0 group-hover:opacity-50'
              }`} />
            </div>
            <div
              onMouseDown={(e) => { e.preventDefault(); setIsResizingFocus(true) }}
              className="absolute top-0 -right-2 w-4 h-full cursor-col-resize z-30 group flex items-center justify-center"
            >
              <div className={`w-0.5 h-10 rounded-full transition-all duration-200 ${
                isResizingFocus
                  ? 'bg-[var(--color-accent)] opacity-80 h-16'
                  : 'bg-[var(--color-border)] opacity-0 group-hover:opacity-50'
              }`} />
            </div>
          </>
        )}
        {currentNote ? (
          <NoteEditor note={currentNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] md:w-[600px] md:h-[400px] rounded-full opacity-20 hidden md:block md:blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, var(--color-accent) 0%, transparent 60%)' }}
            />

            <div className="text-center relative z-10 animate-blur-in max-w-md px-4">
              <div className="relative w-24 h-24 md:w-36 md:h-36 mx-auto mb-6 md:mb-8">
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
    </div>
  )
}
