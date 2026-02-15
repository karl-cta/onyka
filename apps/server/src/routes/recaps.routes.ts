import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { recapsService } from '../services/recaps.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// Get pending recap (if any)
router.get('/pending', async (req, res, next) => {
  try {
    const recap = await recapsService.getPendingRecap(req.userId!)
    res.json({ recap })
  } catch (error) {
    next(error)
  }
})

// Get recap history
const historySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
})

router.get('/history', async (req, res, next) => {
  try {
    const { limit } = historySchema.parse(req.query)
    const recaps = await recapsService.getRecapHistory(req.userId!, limit)
    res.json({ recaps })
  } catch (error) {
    next(error)
  }
})

// Mark a recap as shown (dismiss)
const dismissSchema = z.object({
  id: z.string().min(1),
})

router.patch('/:id/dismiss', async (req, res, next) => {
  try {
    const { id } = dismissSchema.parse(req.params)
    await recapsService.markRecapAsShown(id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
