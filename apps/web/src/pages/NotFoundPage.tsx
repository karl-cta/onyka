import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IoHomeOutline } from 'react-icons/io5'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="text-center max-w-md">
        <p className="text-[7rem] font-extrabold leading-none text-[var(--color-accent)] opacity-20 select-none">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 text-[var(--color-text-secondary)] text-sm leading-relaxed">
          {t('notFound.message')}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
            bg-[var(--color-accent)] text-white
            hover:opacity-90 transition-opacity
            focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)]"
          aria-label={t('notFound.back_home')}
        >
          <IoHomeOutline className="w-4 h-4" />
          {t('notFound.back_home')}
        </button>
      </div>
    </div>
  )
}
