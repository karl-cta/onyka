import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { settingsService } from '../services/settings.service.js'
import { authenticate, invalidateDefaultUserCache } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router: RouterType = Router()

const updateSettingsSchema = z.object({
  authDisabled: z.boolean().optional(),
  allowRegistration: z.boolean().optional(),
  appName: z.string().min(1).max(50).optional(),
})

// GET /api/settings - Get current settings (public, needed before auth)
router.get('/', async (_req, res, next) => {
  try {
    const settings = await settingsService.get()
    res.json({
      settings: {
        authDisabled: settings.authDisabled,
        allowRegistration: settings.allowRegistration,
        appName: settings.appName,
      },
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/settings - Update settings (requires admin)
router.patch('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body)
    const previousSettings = await settingsService.get()
    await settingsService.update(data)

    // When authDisabled changes, invalidate the default user cache
    if (data.authDisabled !== undefined) {
      invalidateDefaultUserCache()
    }

    // When auth is disabled, force allowRegistration off
    if (data.authDisabled === true && previousSettings.allowRegistration) {
      await settingsService.update({ allowRegistration: false })
    }

    // Re-fetch after potential allowRegistration change
    const finalSettings = await settingsService.get()

    // Warn when re-enabling auth: content created under the system user
    // will no longer be accessible until an admin manually reassigns it.
    const warning = (data.authDisabled === false && previousSettings.authDisabled)
      ? 'Content created while authentication was disabled belongs to the system user and will not be accessible from new accounts.'
      : undefined

    res.json({
      settings: {
        authDisabled: finalSettings.authDisabled,
        allowRegistration: finalSettings.allowRegistration,
        appName: finalSettings.appName,
      },
      ...(warning && { warning }),
    })
  } catch (error) {
    next(error)
  }
})

export default router
