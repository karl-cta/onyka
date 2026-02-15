import { useState, useEffect, useCallback, useMemo } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { SparkIcon } from '@/components/ui'
import { setLanguageWithServer, getCurrentLanguage } from '@/i18n'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import {
  IoRocketOutline,
  IoArrowForwardOutline,
  IoDownloadOutline,
  IoGlobeOutline,
} from 'react-icons/io5'
import type { Language } from '@onyka/shared'

// ─── Constants ───────────────────────────────────────────────

const ONBOARDING_PREFIX = 'onyka_onboarding_'
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ─── Hook ────────────────────────────────────────────────────

const REPLAY_EVENT = 'onyka-replay-onboarding'

function getStorageKey(userId: string) {
  return `${ONBOARDING_PREFIX}${userId}`
}

export function useOnboarding(userId?: string, onboardingCompleted?: boolean) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    // Server says onboarding already done — sync localStorage cache
    if (onboardingCompleted) {
      localStorage.setItem(getStorageKey(userId), 'true')
      return
    }
    // Fast path: localStorage cache says done
    if (localStorage.getItem(getStorageKey(userId))) return
    // Neither server nor cache — show onboarding
    const timer = setTimeout(() => setIsOpen(true), 350)
    return () => clearTimeout(timer)
  }, [userId, onboardingCompleted])

  // Listen for replay event from Settings
  useEffect(() => {
    const handleReplay = () => setIsOpen(true)
    window.addEventListener(REPLAY_EVENT, handleReplay)
    return () => window.removeEventListener(REPLAY_EVENT, handleReplay)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    if (userId) {
      localStorage.setItem(getStorageKey(userId), 'true')
      // Persist to server (best-effort) and update local user state
      authApi.completeOnboarding().then(() => {
        const { user, setUser } = useAuthStore.getState()
        if (user) setUser({ ...user, onboardingCompleted: true })
      }).catch(() => {
        // Silently fail — localStorage cache prevents re-showing
      })
    }
  }, [userId])

  return { isOpen, close }
}

/** Dispatch from anywhere (e.g. Settings) to replay the onboarding */
export function replayOnboarding() {
  window.dispatchEvent(new CustomEvent(REPLAY_EVENT))
}

// ─── Platform detection ──────────────────────────────────────

function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

// ─── Types ───────────────────────────────────────────────────

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

type Phase = 'welcome' | 'language' | 'tour'

// ─── Variants ────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 40 : -40,
    scale: 0.96,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -40 : 40,
    scale: 0.96,
  }),
}

// ─── Main component ─────────────────────────────────────────

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [phase, setPhase] = useState<Phase>('welcome')
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  const TOTAL_STEPS = 3

  // Reset on reopen
  useEffect(() => {
    if (isOpen) {
      setPhase('welcome')
      setStep(0)
      setDirection(1)
    }
  }, [isOpen])

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1)
      setStep(s => s + 1)
    } else {
      onClose()
    }
  }, [step, onClose])

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const advanceWelcome = useCallback(() => {
    setPhase('language')
  }, [])

  const handleLanguageSelected = useCallback(() => {
    setPhase('tour')
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (phase === 'welcome') {
          setPhase('language')
        } else if (phase === 'tour') {
          handleNext()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, phase, handleNext, onClose])

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {/* Backdrop — no backdrop-blur on mobile (very expensive on WebKit) */}
        <div className="absolute inset-0 bg-black/80 sm:bg-black/70 sm:backdrop-blur-md" />

        {/* Content */}
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('onboarding.welcome')}
          className="relative flex items-center justify-center h-full p-4"
        >
          <AnimatePresence mode="wait">
            {phase === 'welcome' && (
              <WelcomePhase key="welcome" onClick={advanceWelcome} />
            )}
            {phase === 'language' && (
              <LanguagePhase key="language" onSelected={handleLanguageSelected} />
            )}
            {phase === 'tour' && (
              <TourCard
                key="tour"
                step={step}
                direction={direction}
                totalSteps={TOTAL_STEPS}
                onNext={handleNext}
                onSkip={handleSkip}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

// ─── Welcome phase ───────────────────────────────────────────

function WelcomePhase({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <motion.div
      className="text-center cursor-pointer select-none max-w-md px-4"
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.25, ease: EXPO_OUT }}
    >
      {/* Logo — no blur glow on mobile (expensive on WebKit), desktop keeps blur-2xl */}
      <motion.div
        className="relative w-24 h-24 mx-auto mb-8"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EXPO_OUT }}
      >
        <div
          className="absolute inset-[-50%] rounded-full opacity-40 hidden sm:block sm:blur-2xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent-glow), transparent 70%)' }}
        />
        <OnykaLogo className="relative w-full h-full drop-shadow-lg sm:drop-shadow-2xl" />
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: EXPO_OUT }}
      >
        {t('onboarding.welcome')}
      </motion.h1>

      {/* Tagline */}
      <motion.p
        className="text-lg text-white/50 font-light"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: EXPO_OUT }}
      >
        {t('onboarding.tagline')}
      </motion.p>

      {/* Tap hint */}
      <motion.p
        className="text-xs text-white/25 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0.6] }}
        transition={{ delay: 1.0, duration: 0.8 }}
      >
        {t('onboarding.tap_to_continue')}
      </motion.p>
    </motion.div>
  )
}

// ─── Language phase ──────────────────────────────────────────

function LanguagePhase({ onSelected }: { onSelected: () => void }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Language | null>(null)
  const currentLang = getCurrentLanguage()

  const handleSelect = useCallback(async (lang: Language) => {
    setSelected(lang)
    if (lang !== currentLang) {
      await setLanguageWithServer(lang)
    }
    // Small delay to let the selection animation play
    setTimeout(onSelected, 200)
  }, [currentLang, onSelected])

  return (
    <motion.div
      className="w-full max-w-xs"
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -10 }}
      transition={{ duration: 0.25, ease: EXPO_OUT }}
    >
      {/* Icon */}
      <motion.div
        className="flex justify-center mb-6"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.3, ease: EXPO_OUT }}
      >
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-[-40%] rounded-full opacity-30 hidden sm:block sm:blur-xl"
            style={{ background: 'var(--color-accent)' }}
          />
          <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-white/10 border border-white/10">
            <IoGlobeOutline className="w-8 h-8 text-white/80" />
          </div>
        </div>
      </motion.div>

      {/* Title */}
      <motion.p
        className="text-center text-white/60 text-sm mb-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.25, ease: EXPO_OUT }}
      >
        {t('onboarding.choose_language')}
      </motion.p>

      {/* Language buttons */}
      <div className="flex gap-3">
        {([
          { code: 'fr' as Language, label: 'Fran\u00e7ais', flag: '\ud83c\uddeb\ud83c\uddf7' },
          { code: 'en' as Language, label: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
        ]).map((lang, i) => (
          <motion.button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={`flex-1 flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border transition-all duration-200 ${
              selected === lang.code
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 scale-[1.02]'
                : currentLang === lang.code && !selected
                  ? 'border-white/20 bg-white/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
            }`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.06, duration: 0.25, ease: EXPO_OUT }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-2xl font-bold text-white/90">{lang.flag}</span>
            <span className="text-sm text-white/70">{lang.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Tour card ───────────────────────────────────────────────

interface TourCardProps {
  step: number
  direction: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
}

function TourCard({ step, direction, totalSteps, onNext, onSkip }: TourCardProps) {
  const { t } = useTranslation()
  const isLastStep = step === totalSteps - 1

  const steps = useMemo(() => [
    {
      visual: <SparksVisual />,
      title: t('onboarding.sparks_title'),
      content: (
        <p className="text-sm text-[var(--color-text-secondary)] text-center leading-relaxed">
          {t('onboarding.sparks_desc')}
        </p>
      ),
    },
    {
      visual: <FocusVisual />,
      title: t('onboarding.focus_title'),
      content: (
        <p className="text-sm text-[var(--color-text-secondary)] text-center leading-relaxed">
          {t('onboarding.focus_desc')}
        </p>
      ),
    },
    {
      visual: <TipsVisual />,
      title: t('onboarding.tips_title'),
      content: <TipsContent />,
    },
  ], [t])

  const currentStep = steps[step]

  return (
    <motion.div
      className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-[var(--color-border-subtle)]"
      style={{ background: 'var(--color-bg-elevated)' }}
      initial={{ opacity: 0, scale: 0.88, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 30 }}
      transition={{ duration: 0.28, ease: EXPO_OUT }}
    >
      {/* Skip */}
      <div className="flex justify-end px-5 pt-4">
        <button
          onClick={onSkip}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-200"
        >
          {t('onboarding.skip')}
        </button>
      </div>

      {/* Step content */}
      <div className="px-8 pt-2 pb-6 min-h-[240px] flex flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: EXPO_OUT }}
            className="flex flex-col items-center"
          >
            {/* Visual */}
            <div className="mb-6">
              {currentStep.visual}
            </div>

            {/* Title */}
            <motion.h2
              className="text-xl font-semibold text-[var(--color-text-primary)] text-center mb-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.2, ease: EXPO_OUT }}
            >
              {currentStep.title}
            </motion.h2>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2, ease: EXPO_OUT }}
            >
              {currentStep.content}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-8 pb-7">
        {/* Dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full"
              animate={{
                width: i === step ? 24 : 6,
                backgroundColor: i === step
                  ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
                opacity: i === step ? 1 : 0.3,
              }}
              transition={{ duration: 0.2, ease: EXPO_OUT }}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 80%, #000))',
            boxShadow: '0 4px 16px -3px var(--color-accent-glow)',
          }}
        >
          {isLastStep ? t('onboarding.get_started') : t('onboarding.next')}
          <IoArrowForwardOutline className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Step visuals ────────────────────────────────────────────

function SparksVisual() {
  return (
    <div className="relative w-20 h-20">
      <div
        className="absolute inset-[-30%] rounded-full opacity-20 hidden sm:block sm:blur-xl"
        style={{ background: 'var(--color-accent)' }}
      />
      <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
        <SparkIcon className="w-10 h-10 text-[var(--color-accent)]" animated />
      </div>
    </div>
  )
}

function FocusVisual() {
  return (
    <div className="relative w-20 h-20">
      <div
        className="absolute inset-[-30%] rounded-full opacity-20 hidden sm:block sm:blur-xl"
        style={{ background: 'var(--color-accent)' }}
      />
      <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
        <IoRocketOutline className="w-10 h-10 text-[var(--color-accent)]" />
      </div>
    </div>
  )
}

function TipsVisual() {
  return (
    <div className="flex gap-2 items-center">
      <KeyCap delay={0}>/</KeyCap>
    </div>
  )
}

function KeyCap({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      className="flex items-center justify-center min-w-[2.8rem] h-11 px-3 rounded-xl text-[var(--color-text-primary)] font-mono text-base border shadow-[0_2px_0_0_var(--color-border)]"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.25, ease: EXPO_OUT }}
    >
      {children}
    </motion.div>
  )
}

// ─── Tips content ────────────────────────────────────────────

function TipsContent() {
  const { t } = useTranslation()
  const platform = useMemo(getPlatform, [])
  const isMobilePlatform = platform === 'ios' || platform === 'android'

  return (
    <div className="space-y-3 w-full">
      {/* Slash commands */}
      <div className="text-sm text-center">
        <p className="text-[var(--color-text-secondary)]">
          <span className="font-mono text-[var(--color-accent)]">/</span>{' '}
          {t('onboarding.tips_slash')}
        </p>
      </div>

      {/* PWA hint — only detailed on mobile */}
      {isMobilePlatform && (
        <div
          className="flex gap-3 p-3.5 rounded-xl text-sm border"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
          }}
        >
          <IoDownloadOutline className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[var(--color-text-primary)] font-medium text-xs">
              {t('onboarding.pwa_title')}
            </p>
            <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">
              {t(`onboarding.pwa_${platform}`)}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
