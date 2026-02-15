import { eq, and, ne, count, isNotNull, gte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { User, UserCreateInput, UserUpdateInput, Language, UserRole, UserPreferences } from '@onyka/shared'

const { users, notes } = schema

export interface UserWithPassword {
  id: string
  username: string
  passwordHash: string
  name: string
  email: string | null
  emailVerified: boolean
  avatarUrl: string | null
  avatarColor: string
  role: UserRole
  isDisabled: boolean
  disabledAt: Date | null
  disabledReason: string | null
  twoFactorSecret: string | null
  twoFactorEnabled: boolean
  trackingEnabled: boolean
  language: Language
  // User preferences
  theme: 'light' | 'dark'
  darkThemeBase: string
  lightThemeBase: string
  accentColor: string
  editorFontSize: string
  editorFontFamily: string
  sidebarCollapsed: boolean
  sidebarWidth: number
  tagsCollapsed: boolean
  tagsSectionHeight: number
  sharedCollapsed: boolean
  sharedSectionHeight: number
  onboardingCompleted: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result[0] ? this.mapToUser(result[0]) : null
  }

  async findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result[0] ?? null
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`)
      .limit(1)
    return result[0] ? this.mapToUser(result[0]) : null
  }

  async findByUsernameWithPassword(username: string): Promise<UserWithPassword | null> {
    const result = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`)
      .limit(1)
    return result[0] ?? null
  }

  async create(input: Omit<UserCreateInput, 'password'> & { passwordHash: string; role?: UserRole }): Promise<User> {
    const now = new Date()
    const id = nanoid()
    const role = input.role || 'user'
    const name = input.name || input.username // Use username as default display name

    await db.insert(users).values({
      id,
      username: input.username,
      passwordHash: input.passwordHash,
      name,
      email: input.email?.toLowerCase(),
      role,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      username: input.username,
      name,
      email: input.email?.toLowerCase(),
      emailVerified: false,
      avatarColor: 'blue',
      role,
      isDisabled: false,
      twoFactorEnabled: false,
      trackingEnabled: true,
      language: 'en',
      // Default preferences (match schema defaults)
      theme: 'dark',
      darkThemeBase: 'default',
      lightThemeBase: 'default',
      accentColor: 'blue',
      editorFontSize: 'S',
      editorFontFamily: 'plus-jakarta-sans',
      sidebarCollapsed: false,
      sidebarWidth: 288,
      tagsCollapsed: false,
      tagsSectionHeight: 120,
      sharedCollapsed: false,
      sharedSectionHeight: 150,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, input: UserUpdateInput): Promise<User | null> {
    const now = new Date()
    await db
      .update(users)
      .set({
        ...input,
        updatedAt: now,
      })
      .where(eq(users.id, id))

    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id))
    return result.changes > 0
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, id))
  }

  async setTrackingEnabled(id: string, enabled: boolean): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ trackingEnabled: enabled, updatedAt: now })
      .where(eq(users.id, id))
  }

  async getTrackingEnabled(id: string): Promise<boolean> {
    const result = await db.select({ trackingEnabled: users.trackingEnabled }).from(users).where(eq(users.id, id)).limit(1)
    return result[0]?.trackingEnabled ?? true
  }

  async setLanguage(id: string, language: Language): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ language, updatedAt: now })
      .where(eq(users.id, id))
  }

  async getLanguage(id: string): Promise<Language> {
    const result = await db.select({ language: users.language }).from(users).where(eq(users.id, id)).limit(1)
    return (result[0]?.language as Language) ?? 'en'
  }

  async searchByUsername(query: string, excludeUserId: string, limit: number = 10): Promise<Pick<User, 'id' | 'username' | 'name' | 'avatarUrl' | 'avatarColor'>[]> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        avatarColor: users.avatarColor,
      })
      .from(users)
      .where(
        and(
          sql`LOWER(${users.username}) LIKE ${'%' + query.toLowerCase() + '%'}`,
          ne(users.id, excludeUserId)
        )
      )
      .limit(limit)

    return result.map(r => ({
      id: r.id,
      username: r.username,
      name: r.name,
      avatarUrl: r.avatarUrl ?? undefined,
      avatarColor: r.avatarColor,
    }))
  }

  // Admin methods

  async countAll(): Promise<number> {
    const result = await db.select({ count: count() }).from(users)
    return result[0]?.count ?? 0
  }

  async countActive(since: Date): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isDisabled, false), gte(users.lastLoginAt, since)))
    return result[0]?.count ?? 0
  }

  async countDisabled(): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(eq(users.isDisabled, true))
    return result[0]?.count ?? 0
  }

  async countAdmins(): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(eq(users.role, 'admin'))
    return result[0]?.count ?? 0
  }

  async countWithEmail(): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(
      and(isNotNull(users.email), ne(users.email, ''))
    )
    return result[0]?.count ?? 0
  }

  async countWith2FA(): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(eq(users.twoFactorEnabled, true))
    return result[0]?.count ?? 0
  }

  async countNotDisabled(): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(eq(users.isDisabled, false))
    return result[0]?.count ?? 0
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
    return result[0] ? this.mapToUser(result[0]) : null
  }

  async findByEmailOrUsername(identifier: string): Promise<UserWithPassword | null> {
    const lowerIdentifier = identifier.toLowerCase()
    const result = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(${users.username}) = ${lowerIdentifier} OR LOWER(${users.email}) = ${lowerIdentifier}`
      )
      .limit(1)
    return result[0] ?? null
  }

  async setEmail(id: string, email: string | null): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ email: email?.toLowerCase(), emailVerified: false, updatedAt: now })
      .where(eq(users.id, id))
  }

  async setEmailVerified(id: string, verified: boolean): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ emailVerified: verified, updatedAt: now })
      .where(eq(users.id, id))
  }

  async setRole(id: string, role: UserRole): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ role, updatedAt: now })
      .where(eq(users.id, id))
  }

  async setDisabled(id: string, disabled: boolean, reason?: string): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({
        isDisabled: disabled,
        disabledAt: disabled ? now : null,
        disabledReason: disabled ? reason : null,
        updatedAt: now,
      })
      .where(eq(users.id, id))
  }

  async setOnboardingCompleted(id: string): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ onboardingCompleted: true, updatedAt: now })
      .where(eq(users.id, id))
  }

  async setLastLoginAt(id: string): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, id))
  }

  async set2FASecret(id: string, secret: string | null): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({
        twoFactorSecret: secret,
        twoFactorEnabled: secret !== null,
        updatedAt: now,
      })
      .where(eq(users.id, id))
  }

  async set2FAEnabled(id: string, enabled: boolean): Promise<void> {
    const now = new Date()
    await db
      .update(users)
      .set({
        twoFactorEnabled: enabled,
        // Clear secret when disabling (no longer needed for email-based 2FA)
        twoFactorSecret: enabled ? null : null,
        updatedAt: now,
      })
      .where(eq(users.id, id))
  }

  async setAvatarUrl(id: string, avatarUrl: string | null): Promise<User | null> {
    const now = new Date()
    await db
      .update(users)
      .set({ avatarUrl, updatedAt: now })
      .where(eq(users.id, id))
    return this.findById(id)
  }

  async getAvatarUrl(id: string): Promise<string | null> {
    const result = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, id)).limit(1)
    return result[0]?.avatarUrl ?? null
  }

  async updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<User | null> {
    const now = new Date()

    const updateData: Record<string, unknown> = { updatedAt: now }

    if (prefs.theme !== undefined) updateData.theme = prefs.theme
    if (prefs.accentColor !== undefined) updateData.accentColor = prefs.accentColor
    if (prefs.avatarColor !== undefined) updateData.avatarColor = prefs.avatarColor
    if (prefs.editorFontSize !== undefined) updateData.editorFontSize = prefs.editorFontSize
    if (prefs.editorFontFamily !== undefined) updateData.editorFontFamily = prefs.editorFontFamily
    if (prefs.darkThemeBase !== undefined) updateData.darkThemeBase = prefs.darkThemeBase
    if (prefs.lightThemeBase !== undefined) updateData.lightThemeBase = prefs.lightThemeBase
    if (prefs.sidebarCollapsed !== undefined) updateData.sidebarCollapsed = prefs.sidebarCollapsed
    if (prefs.sidebarWidth !== undefined) updateData.sidebarWidth = prefs.sidebarWidth
    if (prefs.tagsCollapsed !== undefined) updateData.tagsCollapsed = prefs.tagsCollapsed
    if (prefs.tagsSectionHeight !== undefined) updateData.tagsSectionHeight = prefs.tagsSectionHeight

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))

    return this.findById(userId)
  }

  async findAllForAdmin(options: {
    page: number
    limit: number
    search?: string
    status?: 'active' | 'disabled' | 'all'
  }): Promise<{ users: UserWithPassword[]; total: number }> {
    const { page, limit, search, status = 'all' } = options
    const offset = (page - 1) * limit

    let whereClause = undefined

    if (status === 'active') {
      whereClause = eq(users.isDisabled, false)
    } else if (status === 'disabled') {
      whereClause = eq(users.isDisabled, true)
    }

    if (search) {
      const searchCondition = sql`LOWER(${users.username}) LIKE ${'%' + search.toLowerCase() + '%'}`
      whereClause = whereClause ? and(whereClause, searchCondition) : searchCondition
    }

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(users.createdAt)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(users).where(whereClause),
    ])

    return {
      users: results,
      total: countResult[0]?.count ?? 0,
    }
  }

  async getNotesCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notes)
      .where(and(eq(notes.ownerId, userId), eq(notes.isDeleted, false)))
    return result[0]?.count ?? 0
  }

  async hasAnyAdmin(): Promise<boolean> {
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1)
    return result.length > 0
  }

  private mapToUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email ?? undefined,
      emailVerified: row.emailVerified,
      avatarUrl: row.avatarUrl ?? undefined,
      avatarColor: row.avatarColor,
      role: row.role as UserRole,
      isDisabled: row.isDisabled,
      twoFactorEnabled: row.twoFactorEnabled,
      trackingEnabled: row.trackingEnabled,
      language: row.language as Language,
      // User preferences
      theme: row.theme as 'light' | 'dark',
      darkThemeBase: row.darkThemeBase,
      lightThemeBase: row.lightThemeBase,
      accentColor: row.accentColor,
      editorFontSize: row.editorFontSize,
      editorFontFamily: row.editorFontFamily,
      sidebarCollapsed: row.sidebarCollapsed,
      sidebarWidth: row.sidebarWidth,
      tagsCollapsed: row.tagsCollapsed,
      tagsSectionHeight: row.tagsSectionHeight,
      sharedCollapsed: row.sharedCollapsed,
      sharedSectionHeight: row.sharedSectionHeight,
      onboardingCompleted: row.onboardingCompleted,
      lastLoginAt: row.lastLoginAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const userRepository = new UserRepository()
