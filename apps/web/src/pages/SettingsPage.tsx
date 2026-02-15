import { useEffect, useState } from 'react'
import {
  IoArrowBackOutline,
  IoShieldCheckmarkOutline,
  IoTextOutline,
  IoTrashOutline,
  IoRefreshOutline,
  IoReloadOutline,
  IoGlobeOutline,
  IoColorPaletteOutline,
} from 'react-icons/io5'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, LanguageSwitcher } from '@/components/ui'
import { ConfirmDialog } from '@/components/features'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/components/ui/Toast'
import { notesApi } from '@/services/api'
import { getCurrentLanguage } from '@/i18n'
import type { Note } from '@onyka/shared'

export function SettingsPage() {
  const { t } = useTranslation()
  const { settings, isLoading, fetchSettings, updateSettings } = useSettingsStore()
  const currentLang = getCurrentLanguage()

  const [deletedNotes, setDeletedNotes] = useState<Note[]>([])
  const [isLoadingTrash, setIsLoadingTrash] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false)
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchDeletedNotes()
  }, [fetchSettings])

  const fetchDeletedNotes = async () => {
    setIsLoadingTrash(true)
    try {
      const { notes } = await notesApi.list({ deleted: true })
      setDeletedNotes(notes)
    } catch {
    } finally {
      setIsLoadingTrash(false)
    }
  }

  const handleRestoreNote = async (noteId: string) => {
    setRestoringId(noteId)
    try {
      await notesApi.restore(noteId)
      setDeletedNotes((prev) => prev.filter((n) => n.id !== noteId))
      toast.success('Note restored')
    } catch {
      toast.error('Failed to restore note')
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
      toast.success('Trash emptied')
    } catch {
      toast.error('Failed to empty trash')
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
      toast.success('Settings updated')
    } catch {
      toast.error('Failed to update settings')
    }
  }

  if (isLoading && !settings) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-secondary)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" aria-label="Back to notes">
              <IoArrowBackOutline className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{t('settings.title')}</h1>
        </div>

        <div className="space-y-6">
          <section className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <IoColorPaletteOutline className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t('settings.appearance')}
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <IoGlobeOutline className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {t('settings.language')}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {currentLang === 'fr' ? 'Français' : 'English'}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 self-end sm:self-center">
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <IoShieldCheckmarkOutline className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Authentication
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    Disable Authentication
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Allow access without login (single-user mode)
                  </p>
                </div>
                <div className="flex-shrink-0 self-end sm:self-center">
                  <ToggleSwitch
                    checked={settings?.authDisabled ?? false}
                    onChange={(checked) => handleToggle('authDisabled', checked)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    Allow Registration
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Allow new users to create accounts
                  </p>
                </div>
                <div className="flex-shrink-0 self-end sm:self-center">
                  <ToggleSwitch
                    checked={settings?.allowRegistration ?? true}
                    onChange={(checked) => handleToggle('allowRegistration', checked)}
                    disabled={settings?.authDisabled}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <IoTextOutline className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Application
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">App Name</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {settings?.appName ?? 'Onyka'}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 sm:p-6">
            <div className="flex items-start sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <IoTrashOutline className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Trash
                </h2>
                {deletedNotes.length > 0 && (
                  <span className="text-sm text-[var(--color-text-tertiary)]">
                    ({deletedNotes.length})
                  </span>
                )}
              </div>
              {deletedNotes.length > 0 && (
                <button
                  onClick={() => setShowEmptyTrashDialog(true)}
                  className="text-sm text-[var(--color-error)] hover:text-[var(--color-error)]/80 transition-colors flex-shrink-0"
                >
                  Empty trash
                </button>
              )}
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Deleted notes are kept for 30 days before being permanently removed.
            </p>

            {isLoadingTrash ? (
              <div className="flex items-center justify-center py-8">
                <IoReloadOutline className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
              </div>
            ) : deletedNotes.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                <IoTrashOutline className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Trash is empty</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[var(--color-bg-tertiary)] group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] truncate text-sm">
                        {note.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {getDaysRemaining(note.deletedAt)} days remaining
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
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showEmptyTrashDialog}
        onClose={() => setShowEmptyTrashDialog(false)}
        onConfirm={handleEmptyTrash}
        title="Empty trash?"
        message={`${deletedNotes.length} note${deletedNotes.length === 1 ? '' : 's'} will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Empty trash"
        isLoading={isEmptyingTrash}
      />
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer'
      } ${
        checked
          ? 'bg-[var(--color-accent)]'
          : 'bg-[var(--color-bg-tertiary)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
