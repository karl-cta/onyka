import { Router, type Request, type Router as RouterType } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { notesService } from '../services/notes.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// Rate limit: 120 note creations per hour per user
const createNoteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => (req as Request).userId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many notes created, please try again later' } },
})

// 20 MB max for note content (JSON with image URLs, not base64)
const MAX_CONTENT_LENGTH = 20_000_000

const createNoteSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  icon: z.string().max(50).optional(),
  isQuickNote: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
})

const updateNoteSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  icon: z.string().max(50).optional(),
  isQuickNote: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
})

const listNotesSchema = z.object({
  folderId: z.string().nullable().optional(),
  tagIds: z.string().optional(),
  deleted: z.enum(['true', 'false']).optional(),
})

const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
})

router.get('/search', async (req, res, next) => {
  try {
    const { q } = searchSchema.parse(req.query)
    const results = await notesService.search(q, req.userId!)
    res.json({ results })
  } catch (error) {
    next(error)
  }
})

router.get('/shared-with-me', async (req, res, next) => {
  try {
    const notes = await notesService.getSharedWithMe(req.userId!)
    res.json({ notes })
  } catch (error) {
    next(error)
  }
})

// Quick notes endpoints
router.get('/quick', async (req, res, next) => {
  try {
    const notes = await notesService.getQuickNotes(req.userId!)
    res.json({ notes })
  } catch (error) {
    next(error)
  }
})

router.post('/quick', createNoteRateLimit, async (req, res, next) => {
  try {
    const note = await notesService.createQuickNote(req.userId!)
    res.status(201).json({ note })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const query = listNotesSchema.parse(req.query)

    if (query.deleted === 'true') {
      const notes = await notesService.getDeleted(req.userId!)
      return res.json({ notes })
    }

    const filters: {
      folderId?: string | null
      tagIds?: string[]
    } = {}

    if (query.folderId !== undefined) {
      filters.folderId = query.folderId === 'null' ? null : query.folderId
    }
    if (query.tagIds) {
      filters.tagIds = query.tagIds.split(',')
    }

    const notes = await notesService.list(req.userId!, filters)
    res.json({ notes })
  } catch (error) {
    next(error)
  }
})

router.post('/', createNoteRateLimit, async (req, res, next) => {
  try {
    const input = createNoteSchema.parse(req.body)
    const note = await notesService.create(req.userId!, input)
    res.status(201).json({ note })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const note = await notesService.getById(req.params.id, req.userId!)
    res.json({ note })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const input = updateNoteSchema.parse(req.body)
    const note = await notesService.update(req.params.id, req.userId!, input)
    res.json({ note })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await notesService.delete(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/restore', async (req, res, next) => {
  try {
    const note = await notesService.restore(req.params.id, req.userId!)
    res.json({ note })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id/permanent', async (req, res, next) => {
  try {
    await notesService.permanentDelete(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/tags/:tagId', async (req, res, next) => {
  try {
    await notesService.addTag(req.params.id, req.userId!, req.params.tagId)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id/tags/:tagId', async (req, res, next) => {
  try {
    await notesService.removeTag(req.params.id, req.userId!, req.params.tagId)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
