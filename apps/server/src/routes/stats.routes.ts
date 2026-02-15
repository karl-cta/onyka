import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { statsService } from '../services/stats.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// Get stats overview (today, totals, streak)
router.get('/overview', async (req, res, next) => {
  try {
    const overview = await statsService.getOverview(req.userId!)
    res.json({ overview })
  } catch (error) {
    next(error)
  }
})

// Get stats for a specific period
const periodSchema = z.object({
  period: z.enum(['week', 'month', 'year']).default('week'),
})

router.get('/period', async (req, res, next) => {
  try {
    const { period } = periodSchema.parse(req.query)
    const stats = await statsService.getStatsByPeriod(req.userId!, period)
    res.json({ stats })
  } catch (error) {
    next(error)
  }
})

// Track focus minutes
const focusSchema = z.object({
  minutes: z.number().int().min(1).max(180),
})

router.post('/focus', async (req, res, next) => {
  try {
    const { minutes } = focusSchema.parse(req.body)
    await statsService.trackFocusMinutes(req.userId!, minutes)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Reset all stats
router.delete('/reset', async (req, res, next) => {
  try {
    await statsService.resetStats(req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
