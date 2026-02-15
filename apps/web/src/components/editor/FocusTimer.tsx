import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { IoPlayOutline, IoPauseOutline, IoRefreshOutline, IoTimeOutline } from 'react-icons/io5'
import { statsApi } from '@/services/api'

interface FocusTimerProps {
  className?: string
}

const POMODORO_PRESETS = [
  { label: '25m', seconds: 25 * 60 },
  { label: '45m', seconds: 45 * 60 },
  { label: '60m', seconds: 60 * 60 },
]

const HIDE_DELAY = 3000 // ms before auto-hiding after start

export function FocusTimer({ className = '' }: FocusTimerProps) {
  const { t } = useTranslation()
  const [isRunning, setIsRunning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(25 * 60)
  const [initialTime, setInitialTime] = useState(25 * 60)
  const [showPresets, setShowPresets] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isAutoHidden, setIsAutoHidden] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customInputRef = useRef<HTMLInputElement | null>(null)
  const trackedRef = useRef(false) // Prevent double-tracking

  // Refs to access current values in unmount cleanup
  const isRunningRef = useRef(isRunning)
  const initialTimeRef = useRef(initialTime)
  const timeRemainingRef = useRef(timeRemaining)
  isRunningRef.current = isRunning
  initialTimeRef.current = initialTime
  timeRemainingRef.current = timeRemaining

  // Track focus minutes to the server
  const trackFocusMinutes = useCallback((elapsedSeconds: number) => {
    const minutes = Math.ceil(elapsedSeconds / 60)
    if (minutes <= 0) return
    statsApi.trackFocus(minutes).catch(() => {
      // Best-effort tracking — don't interrupt the user
    })
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1)
      }, 1000)
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false)
      setIsComplete(true)
      setIsAutoHidden(false)
      // Track completed Pomodoro
      if (!trackedRef.current) {
        trackedRef.current = true
        trackFocusMinutes(initialTime)
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(t('editor.timer_complete') || 'Focus session complete!')
      }
      // Stop blinking after 5 seconds
      const blinkTimeout = setTimeout(() => setIsComplete(false), 5000)
      return () => clearTimeout(blinkTimeout)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeRemaining, t, initialTime, trackFocusMinutes])

  // Track partial session on unmount (e.g. exiting focus mode while timer runs)
  useEffect(() => {
    return () => {
      const elapsed = initialTimeRef.current - timeRemainingRef.current
      if (isRunningRef.current && elapsed >= 60 && !trackedRef.current) {
        trackedRef.current = true
        trackFocusMinutes(elapsed)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-hide after delay when timer starts
  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    if (isRunning) {
      setIsAutoHidden(false)
      hideTimeoutRef.current = setTimeout(() => {
        setIsAutoHidden(true)
      }, HIDE_DELAY)
    } else {
      setIsAutoHidden(false)
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [isRunning])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const toggleTimer = () => {
    if (isComplete) {
      setIsComplete(false)
    }
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    // Track elapsed time before reset (if >= 1 min elapsed)
    const elapsed = initialTime - timeRemaining
    if (isRunning && elapsed >= 60 && !trackedRef.current) {
      trackFocusMinutes(elapsed)
    }
    trackedRef.current = false
    setIsRunning(false)
    setIsComplete(false)
    setIsAutoHidden(false)
    setTimeRemaining(initialTime)
  }

  const selectPreset = (seconds: number) => {
    // Track elapsed time before switching preset (if running)
    const elapsed = initialTime - timeRemaining
    if (isRunning && elapsed >= 60 && !trackedRef.current) {
      trackFocusMinutes(elapsed)
    }
    trackedRef.current = false
    setInitialTime(seconds)
    setTimeRemaining(seconds)
    setIsRunning(false)
    setIsComplete(false)
    setIsAutoHidden(false)
    setShowPresets(false)
    setCustomMinutes('')
  }

  const applyCustomTime = () => {
    const mins = parseInt(customMinutes, 10)
    if (mins > 0 && mins <= 180) {
      selectPreset(mins * 60)
    }
  }

  const progress = ((initialTime - timeRemaining) / initialTime) * 100

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-2 transition-opacity duration-300 ${
        isAutoHidden ? 'opacity-0 hover:opacity-100' : isComplete ? 'animate-pulse' : 'opacity-100'
      }`}>
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex flex-col items-stretch rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] transition-colors overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-1.5">
              <IoTimeOutline className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className={`text-sm font-mono font-medium ${
                isComplete ? 'text-[var(--color-accent)]' : timeRemaining < 60 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-primary)]'
              }`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="h-0.5 bg-[var(--color-bg-elevated)]">
              <div
                className="h-full bg-[var(--color-accent)] transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </button>

          {showPresets && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPresets(false)} />
              <div className="absolute top-full left-0 mt-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg py-1 z-50 animate-scale-in min-w-[120px]">
                {POMODORO_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => selectPreset(preset.seconds)}
                    className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                      initialTime === preset.seconds && !customMinutes
                        ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="mx-2 my-1 border-t border-[var(--color-border-subtle)]" />
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <input
                    ref={customInputRef}
                    type="number"
                    min="1"
                    max="180"
                    placeholder="min"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyCustomTime()
                    }}
                    className="w-14 px-2 py-1 text-sm rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] focus:border-[var(--color-accent)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={applyCustomTime}
                    className="px-2 py-1 text-xs font-medium rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
                  >
                    OK
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTimer}
            className={`p-2 rounded-lg transition-all duration-150 ${
              isRunning
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
            }`}
            title={isRunning ? t('editor.pause_timer') || 'Pause' : t('editor.start_timer') || 'Start'}
            aria-label={isRunning ? t('editor.pause_timer') || 'Pause' : t('editor.start_timer') || 'Start'}
          >
            {isRunning ? <IoPauseOutline className="w-4 h-4" /> : <IoPlayOutline className="w-4 h-4" />}
          </button>
          <button
            onClick={resetTimer}
            className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all duration-150"
            title={t('editor.reset_timer') || 'Reset'}
            aria-label={t('editor.reset_timer') || 'Reset'}
          >
            <IoRefreshOutline className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
