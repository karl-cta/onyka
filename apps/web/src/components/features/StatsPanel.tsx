import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  IoFlameOutline,
  IoDocumentTextOutline,
  IoPencilOutline,
  IoTrendingUpOutline,
  IoSyncOutline,
  IoCalendarOutline,
  IoTimeOutline,
} from 'react-icons/io5'
import { useStatsStore } from '@/stores/stats'
import type { DailyStat } from '@onyka/shared'

export function StatsPanel() {
  const { t } = useTranslation()
  const {
    overview,
    periodStats,
    selectedPeriod,
    isLoading,
    trackingEnabled,
    fetchOverview,
    fetchPeriodStats,
    setSelectedPeriod,
  } = useStatsStore()

  useEffect(() => {
    if (trackingEnabled) {
      fetchOverview()
      fetchPeriodStats()
    }
  }, [trackingEnabled, fetchOverview, fetchPeriodStats])

  if (!trackingEnabled) {
    return (
      <div className="p-6 bg-[var(--color-bg-secondary)] rounded-2xl text-center">
        <IoTrendingUpOutline className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-40" />
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {t('stats.disabled_message')}
        </p>
      </div>
    )
  }

  if (isLoading && !overview) {
    return (
      <div className="flex items-center justify-center py-16">
        <IoSyncOutline className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <QuickStatCard
          icon={<IoFlameOutline />}
          value={overview?.currentStreak ?? 0}
          label={t('stats.current_streak')}
          suffix={(overview?.currentStreak ?? 0) <= 1 ? t('stats.day') : t('stats.days')}
          variant={overview?.currentStreak && overview.currentStreak >= 7 ? 'accent' : 'default'}
        />
        <QuickStatCard
          icon={<IoPencilOutline />}
          value={overview?.today?.wordsWritten ?? 0}
          label={t('stats.words_today')}
        />
        <QuickStatCard
          icon={<IoDocumentTextOutline />}
          value={overview?.totalNotes ?? 0}
          label={t('stats.total_notes_created')}
        />
        <QuickStatCard
          icon={<IoTrendingUpOutline />}
          value={overview?.totalWords ?? 0}
          label={t('stats.total_words')}
          formatValue
        />
      </div>

      {(overview?.today?.focusMinutes ?? 0) > 0 || (overview?.totalFocusMinutes ?? 0) > 0 ? (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[var(--color-bg-secondary)]">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
            <IoTimeOutline className="text-lg" />
          </div>
          <div className="flex items-center gap-3 text-sm min-w-0 flex-1">
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {formatFocusTime(overview?.today?.focusMinutes ?? 0)}
              </span>
              <span className="text-[var(--color-text-tertiary)] ml-1">{t('stats.focus_today')}</span>
            </div>
            {(overview?.totalFocusMinutes ?? 0) > 0 && (
              <>
                <span className="text-[var(--color-text-tertiary)]">&middot;</span>
                <div>
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {formatFocusTime(overview?.totalFocusMinutes ?? 0)}
                  </span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">{t('stats.focus_total')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="bg-[var(--color-bg-secondary)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--color-accent)]/10">
              <IoCalendarOutline className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <span className="font-medium text-[var(--color-text-primary)] text-sm">
              {t('stats.activity')}
            </span>
          </div>
          <PeriodSelector
            selected={selectedPeriod}
            onChange={setSelectedPeriod}
          />
        </div>

        <div className="p-4">
          {periodStats && (
            <ActivityChart stats={periodStats.stats} period={selectedPeriod} />
          )}
        </div>

        {periodStats && (
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-tertiary)]/50 border-t border-[var(--color-border-subtle)] text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-tertiary)]">{t(`stats.periods.${selectedPeriod}`)}:</span>
              <span className="font-semibold text-[var(--color-text-primary)]">{formatNumber(periodStats.totalWords)}</span>
              <span className="text-[var(--color-text-tertiary)]">{t('stats.words')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-tertiary)]">{t('stats.avg_per_day')}:</span>
              <span className="font-medium text-[var(--color-text-secondary)]">{formatNumber(periodStats.averageWordsPerDay)}</span>
            </div>
            {periodStats.totalNotes > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-[var(--color-text-secondary)]">{periodStats.totalNotes}</span>
                <span className="text-[var(--color-text-tertiary)]">{t('stats.notes_created_period')}</span>
              </div>
            )}
            {periodStats.totalFocusMinutes > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-[var(--color-text-secondary)]">{formatFocusTime(periodStats.totalFocusMinutes)}</span>
                <span className="text-[var(--color-text-tertiary)]">{t('stats.focus_label')}</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function QuickStatCard({
  icon,
  value,
  label,
  suffix,
  variant = 'default',
  formatValue = false,
}: {
  icon: React.ReactNode
  value: number
  label: string
  suffix?: string
  variant?: 'default' | 'accent'
  formatValue?: boolean
}) {
  const displayValue = formatValue ? formatNumber(value) : value.toLocaleString()
  const isAccent = variant === 'accent'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors ${
        isAccent
          ? 'bg-[var(--color-accent)]/10'
          : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isAccent
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
      }`}>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold tracking-tight ${isAccent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
            {displayValue}
          </span>
          {suffix && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {suffix}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] truncate">{label}</p>
      </div>
    </motion.div>
  )
}

function PeriodSelector({
  selected,
  onChange,
}: {
  selected: 'week' | 'month' | 'year'
  onChange: (period: 'week' | 'month' | 'year') => void
}) {
  const { t } = useTranslation()
  const periods = ['week', 'month', 'year'] as const

  return (
    <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-0.5">
      {periods.map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`relative px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            selected === period
              ? 'text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {selected === period && (
            <motion.div
              layoutId="periodIndicator"
              className="absolute inset-0 bg-[var(--color-accent)] rounded-md"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{t(`stats.periods.${period}`)}</span>
        </button>
      ))}
    </div>
  )
}

function ActivityChart({ stats, period }: { stats: DailyStat[]; period: 'week' | 'month' | 'year' }) {
  const { t } = useTranslation()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartData = useMemo(() => {
    const data: Array<{ date: string; words: number; label: string }> = []

    if (period === 'year') {
      const monthlyData = new Map<string, number>()
      stats.forEach((stat) => {
        const month = stat.date.substring(0, 7)
        monthlyData.set(month, (monthlyData.get(month) || 0) + stat.wordsWritten)
      })

      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = date.toISOString().substring(0, 7)
        const label = date.toLocaleDateString(undefined, { month: 'short' }).slice(0, 3)
        data.push({ date: key, words: monthlyData.get(key) || 0, label })
      }
    } else if (period === 'month') {
      const statsByDate = new Map(stats.map((s) => [s.date, s.wordsWritten]))
      const now = new Date()

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const key = date.toISOString().split('T')[0]
        data.push({ date: key, words: statsByDate.get(key) || 0, label: date.getDate().toString() })
      }
    } else {
      const statsByDate = new Map(stats.map((s) => [s.date, s.wordsWritten]))
      const now = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const key = date.toISOString().split('T')[0]
        const label = date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
        data.push({ date: key, words: statsByDate.get(key) || 0, label })
      }
    }

    return data
  }, [stats, period])

  const maxWords = Math.max(...chartData.map((d) => d.words), 1)
  const padding = { top: 8, bottom: 4, left: 0, right: 0 }
  const svgHeight = 72
  const chartHeight = svgHeight - padding.top - padding.bottom

  const points = useMemo(() => {
    return chartData.map((item, index) => {
      const x = (index / Math.max(chartData.length - 1, 1)) * 100
      const y = padding.top + (1 - item.words / maxWords) * chartHeight
      return { x, y, ...item }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, maxWords, chartHeight])

  const yMin = padding.top
  const yMax = padding.top + chartHeight

  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return ''

    let path = `M ${pts[0].x} ${pts[0].y}`

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = Math.min(Math.max(p1.y + (p2.y - p0.y) / 6, yMin), yMax)
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = Math.min(Math.max(p2.y - (p3.y - p1.y) / 6, yMin), yMax)

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }

    return path
  }

  const linePath = createSmoothPath(points)
  const areaPath = linePath ? `${linePath} L 100,${yMax} L 0,${yMax} Z` : ''

  const getLabels = () => {
    if (period === 'week') return points
    if (period === 'year') return points
    return points.filter((_, i) => i === 0 || i === 9 || i === 19 || i === 29)
  }

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="select-none">
      <div className="h-5 mb-1 flex items-center">
        {hovered ? (
          <div className="flex items-center gap-2 text-xs animate-in fade-in duration-150">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold">
              {hovered.words.toLocaleString()}
              <span className="text-[10px] font-medium opacity-70">{t('stats.words')}</span>
            </span>
            <span className="text-[var(--color-text-tertiary)]">·</span>
            <span className="text-[var(--color-text-secondary)] font-medium">{hovered.label}</span>
          </div>
        ) : (
          <div className="text-xs text-[var(--color-text-tertiary)] opacity-0 select-none">.</div>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 100 ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-16"
          onMouseLeave={() => setHoveredIndex(null)}
        >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#chartGradient)" />

        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((pt, i) => (
          <rect
            key={pt.date}
            x={i === 0 ? 0 : (points[i - 1].x + pt.x) / 2}
            y="0"
            width={i === 0 || i === points.length - 1
              ? 100 / points.length / 2
              : (points[Math.min(i + 1, points.length - 1)].x - points[Math.max(i - 1, 0)].x) / 2}
            height={svgHeight}
            fill="transparent"
            className="cursor-crosshair"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}
        </svg>

        {hovered && (
          <div
            className="absolute w-2 h-2 rounded-full bg-[var(--color-accent)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${hovered.x}%`,
              top: `${(hovered.y / svgHeight) * 100}%`,
            }}
          />
        )}
      </div>

      <div className="flex justify-between mt-1.5 text-[10px] text-[var(--color-text-tertiary)]">
        {getLabels().map((pt, i, arr) => (
          <span
            key={pt.date}
            className={i === arr.length - 1 ? 'text-[var(--color-accent)]' : ''}
          >
            {pt.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function formatFocusTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toLocaleString()
}
