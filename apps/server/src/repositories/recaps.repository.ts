import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { weeklyRecaps } = schema

export interface WeeklyRecap {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  wordsWritten: number
  notesCreated: number
  notesEdited: number
  focusMinutes: number
  currentStreak: number
  isShown: boolean
  shownAt: Date | null
  createdAt: Date
}

export interface CreateRecapData {
  userId: string
  weekStart: string
  weekEnd: string
  wordsWritten: number
  notesCreated: number
  notesEdited: number
  focusMinutes: number
  currentStreak: number
}

export class RecapsRepository {
  // Find recap by ID
  async findById(id: string): Promise<WeeklyRecap | null> {
    const result = await db
      .select()
      .from(weeklyRecaps)
      .where(eq(weeklyRecaps.id, id))
      .limit(1)
    return result[0] ? this.mapToRecap(result[0]) : null
  }

  // Find recap by user and week start date
  async findByWeek(userId: string, weekStart: string): Promise<WeeklyRecap | null> {
    const result = await db
      .select()
      .from(weeklyRecaps)
      .where(and(eq(weeklyRecaps.userId, userId), eq(weeklyRecaps.weekStart, weekStart)))
      .limit(1)
    return result[0] ? this.mapToRecap(result[0]) : null
  }

  // Find the latest unshown recap for a user
  async findPendingRecap(userId: string): Promise<WeeklyRecap | null> {
    const result = await db
      .select()
      .from(weeklyRecaps)
      .where(and(eq(weeklyRecaps.userId, userId), eq(weeklyRecaps.isShown, false)))
      .orderBy(desc(weeklyRecaps.createdAt))
      .limit(1)
    return result[0] ? this.mapToRecap(result[0]) : null
  }

  // Get all recaps for a user (most recent first)
  async findAllByUser(userId: string, limit = 10): Promise<WeeklyRecap[]> {
    const result = await db
      .select()
      .from(weeklyRecaps)
      .where(eq(weeklyRecaps.userId, userId))
      .orderBy(desc(weeklyRecaps.weekStart))
      .limit(limit)
    return result.map(this.mapToRecap)
  }

  // Create a new recap
  async create(data: CreateRecapData): Promise<WeeklyRecap> {
    const id = nanoid()
    const now = new Date()

    await db.insert(weeklyRecaps).values({
      id,
      userId: data.userId,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      wordsWritten: data.wordsWritten,
      notesCreated: data.notesCreated,
      notesEdited: data.notesEdited,
      focusMinutes: data.focusMinutes,
      currentStreak: data.currentStreak,
      isShown: false,
      shownAt: null,
      createdAt: now,
    })

    return {
      id,
      userId: data.userId,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      wordsWritten: data.wordsWritten,
      notesCreated: data.notesCreated,
      notesEdited: data.notesEdited,
      focusMinutes: data.focusMinutes,
      currentStreak: data.currentStreak,
      isShown: false,
      shownAt: null,
      createdAt: now,
    }
  }

  // Mark a recap as shown
  async markAsShown(id: string): Promise<void> {
    const now = new Date()
    await db
      .update(weeklyRecaps)
      .set({
        isShown: true,
        shownAt: now,
      })
      .where(eq(weeklyRecaps.id, id))
  }

  // Delete all recaps for a user (used when resetting stats)
  async deleteAllByUser(userId: string): Promise<void> {
    await db.delete(weeklyRecaps).where(eq(weeklyRecaps.userId, userId))
  }

  // Helper to map DB row to WeeklyRecap
  private mapToRecap(row: typeof weeklyRecaps.$inferSelect): WeeklyRecap {
    return {
      id: row.id,
      userId: row.userId,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      wordsWritten: row.wordsWritten,
      notesCreated: row.notesCreated,
      notesEdited: row.notesEdited,
      focusMinutes: row.focusMinutes,
      currentStreak: row.currentStreak,
      isShown: row.isShown,
      shownAt: row.shownAt,
      createdAt: row.createdAt,
    }
  }
}

export const recapsRepository = new RecapsRepository()
