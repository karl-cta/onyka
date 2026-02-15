import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { userStats } = schema

export interface DailyStat {
  id: string
  userId: string
  date: string
  wordsWritten: number
  notesCreated: number
  notesEdited: number
  focusMinutes: number
  createdAt: Date
  updatedAt: Date
}

export class StatsRepository {
  async findByDate(userId: string, date: string): Promise<DailyStat | null> {
    const result = await db
      .select()
      .from(userStats)
      .where(and(eq(userStats.userId, userId), eq(userStats.date, date)))
      .limit(1)
    return result[0] ? this.mapToStat(result[0]) : null
  }

  async findByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyStat[]> {
    const result = await db
      .select()
      .from(userStats)
      .where(
        and(
          eq(userStats.userId, userId),
          gte(userStats.date, startDate),
          lte(userStats.date, endDate)
        )
      )
      .orderBy(desc(userStats.date))
    return result.map(this.mapToStat)
  }

  async getOrCreateToday(userId: string): Promise<DailyStat> {
    const today = this.getTodayDate()
    const existing = await this.findByDate(userId, today)
    if (existing) return existing

    const now = new Date()
    const id = nanoid()

    await db.insert(userStats).values({
      id,
      userId,
      date: today,
      wordsWritten: 0,
      notesCreated: 0,
      notesEdited: 0,
      focusMinutes: 0,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      userId,
      date: today,
      wordsWritten: 0,
      notesCreated: 0,
      notesEdited: 0,
      focusMinutes: 0,
      createdAt: now,
      updatedAt: now,
    }
  }

  async incrementWordsWritten(userId: string, words: number): Promise<void> {
    const stat = await this.getOrCreateToday(userId)
    const now = new Date()
    await db
      .update(userStats)
      .set({
        wordsWritten: stat.wordsWritten + words,
        updatedAt: now,
      })
      .where(eq(userStats.id, stat.id))
  }

  async incrementNotesCreated(userId: string): Promise<void> {
    const stat = await this.getOrCreateToday(userId)
    const now = new Date()
    await db
      .update(userStats)
      .set({
        notesCreated: stat.notesCreated + 1,
        updatedAt: now,
      })
      .where(eq(userStats.id, stat.id))
  }

  async incrementNotesEdited(userId: string): Promise<void> {
    const stat = await this.getOrCreateToday(userId)
    const now = new Date()
    await db
      .update(userStats)
      .set({
        notesEdited: stat.notesEdited + 1,
        updatedAt: now,
      })
      .where(eq(userStats.id, stat.id))
  }

  async incrementFocusMinutes(userId: string, minutes: number): Promise<void> {
    const stat = await this.getOrCreateToday(userId)
    const now = new Date()
    await db
      .update(userStats)
      .set({
        focusMinutes: stat.focusMinutes + minutes,
        updatedAt: now,
      })
      .where(eq(userStats.id, stat.id))
  }

  async getTotalStats(userId: string): Promise<{ totalWords: number; totalNotes: number; totalEdits: number; totalFocusMinutes: number }> {
    const result = await db
      .select({
        totalWords: sql<number>`COALESCE(SUM(${userStats.wordsWritten}), 0)`,
        totalNotes: sql<number>`COALESCE(SUM(${userStats.notesCreated}), 0)`,
        totalEdits: sql<number>`COALESCE(SUM(${userStats.notesEdited}), 0)`,
        totalFocusMinutes: sql<number>`COALESCE(SUM(${userStats.focusMinutes}), 0)`,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))

    return {
      totalWords: result[0]?.totalWords ?? 0,
      totalNotes: result[0]?.totalNotes ?? 0,
      totalEdits: result[0]?.totalEdits ?? 0,
      totalFocusMinutes: result[0]?.totalFocusMinutes ?? 0,
    }
  }

  async getCurrentStreak(userId: string): Promise<number> {
    const stats = await db
      .select({ date: userStats.date })
      .from(userStats)
      .where(
        and(
          eq(userStats.userId, userId),
          sql`(${userStats.wordsWritten} > 0 OR ${userStats.notesCreated} > 0 OR ${userStats.focusMinutes} > 0)`
        )
      )
      .orderBy(desc(userStats.date))

    if (stats.length === 0) return 0

    let streak = 0
    let expectedDate = new Date()
    expectedDate.setHours(0, 0, 0, 0)

    for (const stat of stats) {
      const statDate = new Date(stat.date)
      statDate.setHours(0, 0, 0, 0)

      // Check if this is today or the next expected day in the streak
      const diffDays = Math.floor((expectedDate.getTime() - statDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 0 || diffDays === 1) {
        streak++
        expectedDate = new Date(statDate)
        expectedDate.setDate(expectedDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }

  async resetAllStats(userId: string): Promise<void> {
    await db.delete(userStats).where(eq(userStats.userId, userId))
  }

  private getTodayDate(): string {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  private mapToStat(row: typeof userStats.$inferSelect): DailyStat {
    return {
      id: row.id,
      userId: row.userId,
      date: row.date,
      wordsWritten: row.wordsWritten,
      notesCreated: row.notesCreated,
      notesEdited: row.notesEdited,
      focusMinutes: row.focusMinutes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const statsRepository = new StatsRepository()
