import { Router, type Request, type Router as RouterType } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { sparksService } from '../services/sparks.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// Rate limit: 60 sparks per hour per user
const createSparkRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req as Request).userId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many sparks created, please try again later' } },
})

const createSparkSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content must be less than 2000 characters'),
  isPinned: z.boolean().optional().default(false),
  expiration: z.enum(['none', '1h', '24h', '7d', '30d']).optional().default('none'),
})

const updateSparkSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content must be less than 2000 characters'),
})

const convertToNoteSchema = z.object({
  title: z.string().max(500).optional(),
  mode: z.enum(['text']).optional().default('text'),
  folderId: z.string().nullable().optional(),
})

// GET /api/sparks - List all active sparks (pinned + ephemeral)
router.get('/', async (req, res, next) => {
  try {
    const sparks = await sparksService.list(req.userId!)
    res.json({ sparks })
  } catch (error) {
    next(error)
  }
})

// GET /api/sparks/stats - Get spark counts
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await sparksService.getStats(req.userId!)
    res.json({ stats })
  } catch (error) {
    next(error)
  }
})

// POST /api/sparks - Create a new spark
router.post('/', createSparkRateLimit, async (req, res, next) => {
  try {
    const input = createSparkSchema.parse(req.body)
    const spark = await sparksService.create(req.userId!, input)
    res.status(201).json({ spark })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/sparks/:id - Update spark content
router.patch('/:id', async (req, res, next) => {
  try {
    const input = updateSparkSchema.parse(req.body)
    const spark = await sparksService.update(req.params.id, req.userId!, input.content)
    res.json({ spark })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/sparks/:id/pin - Toggle pin status
router.patch('/:id/pin', async (req, res, next) => {
  try {
    const spark = await sparksService.togglePin(req.params.id, req.userId!)
    res.json({ spark })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/sparks/:id - Delete a spark
router.delete('/:id', async (req, res, next) => {
  try {
    await sparksService.delete(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/sparks/:id/convert - Convert spark to note
router.post('/:id/convert', async (req, res, next) => {
  try {
    const options = convertToNoteSchema.parse(req.body)
    const result = await sparksService.convertToNote(req.params.id, req.userId!, options)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router
