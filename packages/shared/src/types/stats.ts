export interface DailyStat {
  id: string
  userId: string
  date: string // YYYY-MM-DD format
  wordsWritten: number
  notesCreated: number
  notesEdited: number
  focusMinutes: number
  createdAt: Date
  updatedAt: Date
}

export interface StatsOverview {
  today: DailyStat
  currentStreak: number
  totalWords: number
  totalNotes: number
  totalEdits: number
  totalFocusMinutes: number
}

export interface StatsPeriod {
  stats: DailyStat[]
  period: 'week' | 'month' | 'year'
  totalWords: number
  totalNotes: number
  averageWordsPerDay: number
  totalFocusMinutes: number
}

export interface WeeklyRecap {
  id: string
  userId: string
  weekStart: string // YYYY-MM-DD format (Monday)
  weekEnd: string // YYYY-MM-DD format (Sunday)
  wordsWritten: number
  notesCreated: number
  notesEdited: number
  focusMinutes: number
  currentStreak: number
  isShown: boolean
  shownAt: Date | null
  createdAt: Date
}

export interface StatsOverviewResponse {
  overview: StatsOverview
}

export interface StatsPeriodResponse {
  stats: StatsPeriod
}

export interface WeeklyRecapResponse {
  recap: WeeklyRecap | null
}

export interface WeeklyRecapHistoryResponse {
  recaps: WeeklyRecap[]
}
