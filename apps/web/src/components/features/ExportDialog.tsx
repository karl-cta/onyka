import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IoCloseOutline, IoDownloadOutline, IoDocumentTextOutline, IoCodeOutline, IoGlobeOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { type ExportFormat } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ExportDialogBaseProps {
  isOpen: boolean
  onClose: () => void
  title: string
}

interface ExportNoteProps extends ExportDialogBaseProps {
  type: 'note'
  noteId: string
}

interface ExportFolderProps extends ExportDialogBaseProps {
  type: 'folder'
  folderId: string
}

export type ExportDialogProps = ExportNoteProps | ExportFolderProps

interface FormatOption {
  value: ExportFormat
  labelKey: string
  descKey: string
  icon: React.ReactNode
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'md',
    labelKey: 'export.formats.markdown',
    descKey: 'export.format_desc.markdown',
    icon: <IoCodeOutline className="w-5 h-5" />,
  },
  {
    value: 'txt',
    labelKey: 'export.formats.text',
    descKey: 'export.format_desc.text',
    icon: <IoDocumentTextOutline className="w-5 h-5" />,
  },
  {
    value: 'html',
    labelKey: 'export.formats.html',
    descKey: 'export.format_desc.html',
    icon: <IoGlobeOutline className="w-5 h-5" />,
  },
]

export function ExportDialog(props: ExportDialogProps) {
  const { isOpen, onClose, title } = props
  const { t } = useTranslation()
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('md')
  const focusTrapRef = useFocusTrap(isOpen)

  const isFolder = props.type === 'folder'

  const handleExport = () => {
    let url: string
    let downloadName: string

    if (props.type === 'folder') {
      url = `/api/export/folder/${props.folderId}?format=${selectedFormat}`
      downloadName = `${title || 'folder'}.zip`
    } else {
      url = `/api/export/note/${props.noteId}?format=${selectedFormat}`
      downloadName = `${title || 'untitled'}.${selectedFormat}`
    }

    const link = document.createElement('a')
    link.href = url
    link.download = downloadName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label={t('export.title')} className="relative w-full max-w-md bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl border border-[var(--color-border)]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <IoDownloadOutline className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('export.title')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            <IoCloseOutline className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </header>

        <div className="p-6">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            {isFolder
              ? t('export.choose_format_folder', { title: title || t('sidebar.new_folder') })
              : t('export.choose_format', { title: title || t('editor.untitled') })
            }
          </p>
          {isFolder && (
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              {t('export.folder_zip_hint')}
            </p>
          )}
          {!isFolder && <div className="mb-4" />}

          <div className="space-y-2">
            {FORMAT_OPTIONS.map((format) => (
              <button
                key={format.value}
                onClick={() => setSelectedFormat(format.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  selectedFormat === format.value
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <div
                  className={`${
                    selectedFormat === format.value
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {format.icon}
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium text-[var(--color-text-primary)]">{t(format.labelKey)}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {t(format.descKey)}
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedFormat === format.value
                      ? 'border-[var(--color-accent)]'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {selectedFormat === format.value && (
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:brightness-110 active:scale-[0.97] transition-all duration-150"
          >
            <IoDownloadOutline className="w-4 h-4" />
            {isFolder ? t('export.download_zip') : t('export.download')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
