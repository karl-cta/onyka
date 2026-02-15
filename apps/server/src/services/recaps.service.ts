import { recapsRepository, type WeeklyRecap } from '../repositories/recaps.repository.js'
import { statsRepository } from '../repositories/stats.repository.js'

export class RecapsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'RecapsServiceError'
  }
}

export class RecapsService {
  /**
   * Get the pending (unshown) recap for a user.
   * If it's a new week and no recap exists for the previous week, generate one.
   */
  async getPendingRecap(userId: string): Promise<WeeklyRecap | null> {
    // First, try to generate a recap for the previous week if needed
    await this.generateRecapIfNeeded(userId)

    // Then return any pending recap
    return recapsRepository.findPendingRecap(userId)
  }

  /**
   * Mark a recap as shown (user dismissed it)
   * Verifies ownership before marking as shown
   */
  async markRecapAsShown(recapId: string, userId: string): Promise<void> {
    const recap = await recapsRepository.findById(recapId)
    if (!recap) {
      throw new RecapsServiceError('Recap not found', 'RECAP_NOT_FOUND', 404)
    }
    if (recap.userId !== userId) {
      throw new RecapsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
    await recapsRepository.markAsShown(recapId)
  }

  /**
   * Get recap history for a user
   */
  async getRecapHistory(userId: string, limit = 10): Promise<WeeklyRecap[]> {
    return recapsRepository.findAllByUser(userId, limit)
  }

  /**
   * Generate a weekly recap if:
   * 1. It's Monday or later in the week
   * 2. No recap exists for the previous week
   * 3. There was some activity in the previous week
   */
  async generateRecapIfNeeded(userId: string): Promise<WeeklyRecap | null> {
    // Calculate last week's Monday and Sunday
    const lastWeek = this.getLastWeekDates()

    // Check if a recap already exists for last week
    const existingRecap = await recapsRepository.findByWeek(userId, lastWeek.monday)
    if (existingRecap) {
      return null // Already generated
    }

    // Get stats for last week
    const weekStats = await statsRepository.findByDateRange(
      userId,
      lastWeek.monday,
      lastWeek.sunday
    )

    // Calculate totals
    const wordsWritten = weekStats.reduce((sum, s) => sum + s.wordsWritten, 0)
    const notesCreated = weekStats.reduce((sum, s) => sum + s.notesCreated, 0)
    const notesEdited = weekStats.reduce((sum, s) => sum + s.notesEdited, 0)
    const focusMinutes = weekStats.reduce((sum, s) => sum + s.focusMinutes, 0)

    // Only create recap if there was some activity
    if (wordsWritten === 0 && notesCreated === 0 && notesEdited === 0 && focusMinutes === 0) {
      return null
    }

    // Get current streak
    const currentStreak = await statsRepository.getCurrentStreak(userId)

    // Create the recap
    return recapsRepository.create({
      userId,
      weekStart: lastWeek.monday,
      weekEnd: lastWeek.sunday,
      wordsWritten,
      notesCreated,
      notesEdited,
      focusMinutes,
      currentStreak,
    })
  }

  /**
   * Delete all recaps for a user (when stats are reset)
   */
  async deleteAllRecaps(userId: string): Promise<void> {
    await recapsRepository.deleteAllByUser(userId)
  }

  /**
   * Get the Monday and Sunday dates of last week in YYYY-MM-DD format
   */
  private getLastWeekDates(): { monday: string; sunday: string } {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday

    // Calculate days since last Monday (if today is Monday, go back 7 days)
    const daysSinceLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const daysToLastWeekMonday = daysSinceLastMonday + 7

    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - daysToLastWeekMonday)
    lastMonday.setHours(0, 0, 0, 0)

    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)

    return {
      monday: lastMonday.toISOString().split('T')[0],
      sunday: lastSunday.toISOString().split('T')[0],
    }
  }

  /**
   * Format a date range for display (e.g., "Jan 1 - Jan 7, 2024")
   */
  formatWeekRange(weekStart: string, weekEnd: string, locale = 'en'): string {
    const start = new Date(weekStart)
    const end = new Date(weekEnd)

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const startStr = start.toLocaleDateString(locale, options)
    const endStr = end.toLocaleDateString(locale, { ...options, year: 'numeric' })

    return `${startStr} - ${endStr}`
  }
}

export const recapsService = new RecapsService()
