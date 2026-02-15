import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { Toaster } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Lazy load pages
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))


function LoadingSpinner() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  // If already authenticated, show content even during loading
  // (e.g. after login, don't flash a spinner while checkAuth re-validates)
  if (isLoading && !isAuthenticated) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { checkAuth, isLoading } = useAuthStore()
  const [hasResolved, setHasResolved] = useState(false)
  const wasLoadingRef = useRef(true)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Track when loading finishes to trigger fade-in
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Small delay to ensure theme is applied before revealing content
      requestAnimationFrame(() => setHasResolved(true))
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)] text-sm">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`transition-opacity duration-300 ease-out ${hasResolved ? 'opacity-100' : 'opacity-0'}`}
      style={{ minHeight: '100vh' }}
    >
      {children}
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthCheck>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthCheck>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
