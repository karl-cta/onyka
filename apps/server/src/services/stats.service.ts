import { statsRepository, type DailyStat } from '../repositories/stats.repository.js'
import { recapsRepository } from '../repositories/recaps.repository.js'

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

export class StatsService {
  async getOverview(userId: string): Promise<StatsOverview> {
    const [today, currentStreak, totals] = await Promise.all([
      statsRepository.getOrCreateToday(userId),
      statsRepository.getCurrentStreak(userId),
      statsRepository.getTotalStats(userId),
    ])

    return {
      today,
      currentStreak,
      totalWords: totals.totalWords,
      totalNotes: totals.totalNotes,
      totalEdits: totals.totalEdits,
      totalFocusMinutes: totals.totalFocusMinutes,
    }
  }

  async getStatsByPeriod(userId: string, period: 'week' | 'month' | 'year'): Promise<StatsPeriod> {
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'year':
        startDate.setDate(startDate.getDate() - 365)
        break
    }

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    const stats = await statsRepository.findByDateRange(userId, startStr, endStr)

    const totalWords = stats.reduce((sum, s) => sum + s.wordsWritten, 0)
    const totalNotes = stats.reduce((sum, s) => sum + s.notesCreated, 0)
    const totalFocusMinutes = stats.reduce((sum, s) => sum + s.focusMinutes, 0)
    const daysWithActivity = stats.filter(s => s.wordsWritten > 0 || s.notesCreated > 0 || s.focusMinutes > 0).length

    return {
      stats,
      period,
      totalWords,
      totalNotes,
      averageWordsPerDay: daysWithActivity > 0 ? Math.round(totalWords / daysWithActivity) : 0,
      totalFocusMinutes,
    }
  }

  async trackWordsWritten(userId: string, oldContent: string, newContent: string): Promise<void> {
    const oldWords = this.countWords(oldContent)
    const newWords = this.countWords(newContent)
    const diff = newWords - oldWords

    if (diff > 0) {
      await statsRepository.incrementWordsWritten(userId, diff)
    }

    if (Math.abs(diff) > 0 || oldContent !== newContent) {
      await statsRepository.incrementNotesEdited(userId)
    }
  }

  async trackNoteCreated(userId: string): Promise<void> {
    await statsRepository.incrementNotesCreated(userId)
  }

  async trackFocusMinutes(userId: string, minutes: number): Promise<void> {
    if (minutes <= 0) return
    await statsRepository.incrementFocusMinutes(userId, minutes)
  }

  private countWords(content: string): number {
    if (!content) return 0

    const textOnly = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

    const words = textOnly.split(/\s+/).filter((word) => word.length > 0)
    return words.length
  }

  async resetStats(userId: string): Promise<void> {
    await statsRepository.resetAllStats(userId)
    await recapsRepository.deleteAllByUser(userId)
  }
}

export const statsService = new StatsService()
