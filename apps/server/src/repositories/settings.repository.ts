import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'

export type Settings = typeof settings.$inferSelect
export type SettingsUpdate = Partial<Omit<Settings, 'id'>>

const SETTINGS_ID = 'system'

export const settingsRepository = {
  async get(): Promise<Settings> {
    const result = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1)

    if (result.length === 0) {
      // Initialize with defaults
      const now = new Date()
      const defaultSettings: Settings = {
        id: SETTINGS_ID,
        authDisabled: false,
        allowRegistration: true,
        appName: 'Onyka',
        updatedAt: now,
      }

      await db.insert(settings).values(defaultSettings)
      return defaultSettings
    }

    return result[0]
  },

  async update(data: SettingsUpdate): Promise<Settings> {
    const now = new Date()

    await db
      .update(settings)
      .set({ ...data, updatedAt: now })
      .where(eq(settings.id, SETTINGS_ID))

    return this.get()
  },
}
