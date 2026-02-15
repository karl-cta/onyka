import { settingsRepository, type Settings, type SettingsUpdate } from '../repositories/settings.repository.js'

// Cache settings in memory for fast access in middleware
let cachedSettings: Settings | null = null

export const settingsService = {
  async get(): Promise<Settings> {
    if (!cachedSettings) {
      cachedSettings = await settingsRepository.get()
    }
    return cachedSettings
  },

  async update(data: SettingsUpdate): Promise<Settings> {
    const updated = await settingsRepository.update(data)
    cachedSettings = updated
    return updated
  },

  // Quick check for auth middleware (uses cache)
  async isAuthDisabled(): Promise<boolean> {
    const settings = await this.get()
    return settings.authDisabled
  },

  async isRegistrationAllowed(): Promise<boolean> {
    const settings = await this.get()
    return settings.allowRegistration
  },

  // Clear cache (useful for testing)
  clearCache(): void {
    cachedSettings = null
  },
}
