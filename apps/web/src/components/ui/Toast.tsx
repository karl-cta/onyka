import { useEffect, useState, useCallback } from 'react'
import {
  IoCloseOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoInformationCircleOutline,
} from 'react-icons/io5'
import { create } from 'zustand'

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

// Toast store
interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

// Helper function to show toasts
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'error', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'info', title, description }),
}

// Icon mapping
const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <IoCheckmarkCircleOutline className="w-5 h-5 text-green-500" />,
  error: <IoWarningOutline className="w-5 h-5 text-red-500" />,
  warning: <IoWarningOutline className="w-5 h-5 text-yellow-500" />,
  info: <IoInformationCircleOutline className="w-5 h-5 text-blue-500" />,
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-green-500/20 bg-green-500/5',
  error: 'border-red-500/20 bg-red-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  info: 'border-blue-500/20 bg-blue-500/5',
}

// Single toast component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)

  const handleRemove = useCallback(() => {
    setIsExiting(true)
    setTimeout(onRemove, 200)
  }, [onRemove])

  useEffect(() => {
    const duration = toast.duration ?? 5000
    const timer = setTimeout(handleRemove, duration)
    return () => clearTimeout(timer)
  }, [toast.duration, handleRemove])

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-200 ${
        TOAST_STYLES[toast.type]
      } ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
    >
      <div className="flex-shrink-0 mt-0.5">{TOAST_ICONS[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{toast.description}</p>
        )}
      </div>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        aria-label="Dismiss notification"
      >
        <IoCloseOutline className="w-4 h-4 text-[var(--color-text-secondary)]" />
      </button>
    </div>
  )
}

// Toaster container
export function Toaster() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  )
}
