import { useState, useEffect, useRef, useCallback } from 'react'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface UseAutoSaveOptions {
  onSave: () => Promise<void>
  delay?: number
}

export function useAutoSave({ onSave, delay = 1000 }: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const triggerSave = useCallback(() => {
    setStatus('unsaved')

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return

      setStatus('saving')
      try {
        await onSave()
        if (isMountedRef.current) {
          setStatus('saved')
        }
      } catch {
        if (isMountedRef.current) {
          setStatus('error')
        }
      }
    }, delay)
  }, [onSave, delay])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setStatus('saved')
  }, [])

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setStatus('saving')
    try {
      await onSave()
      if (isMountedRef.current) {
        setStatus('saved')
      }
    } catch {
      if (isMountedRef.current) {
        setStatus('error')
      }
    }
  }, [onSave])

  return { status, triggerSave, saveNow, cancel }
}
