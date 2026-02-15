import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { pagesService } from '../services/pages.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// 20 MB max for page content (JSON with image URLs, not base64)
const MAX_CONTENT_LENGTH = 20_000_000

const createPageSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
})

const updatePageSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
})

const reorderPageSchema = z.object({
  newPosition: z.number().int().min(0),
})

// Get all pages for a note
router.get('/note/:noteId', async (req, res, next) => {
  try {
    const pages = await pagesService.getPages(req.params.noteId, req.userId!)
    res.json({ pages })
  } catch (error) {
    next(error)
  }
})

// Get a single page
router.get('/:id', async (req, res, next) => {
  try {
    const page = await pagesService.getPage(req.params.id, req.userId!)
    res.json({ page })
  } catch (error) {
    next(error)
  }
})

// Create a new page
router.post('/note/:noteId', async (req, res, next) => {
  try {
    const input = createPageSchema.parse(req.body)
    const page = await pagesService.createPage(req.params.noteId, req.userId!, input)
    res.status(201).json({ page })
  } catch (error) {
    next(error)
  }
})

// Update a page
router.patch('/:id', async (req, res, next) => {
  try {
    const input = updatePageSchema.parse(req.body)
    const page = await pagesService.updatePage(req.params.id, req.userId!, input)
    res.json({ page })
  } catch (error) {
    next(error)
  }
})

// Delete a page
router.delete('/:id', async (req, res, next) => {
  try {
    await pagesService.deletePage(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// Reorder a page
router.post('/:id/reorder', async (req, res, next) => {
  try {
    const { newPosition } = reorderPageSchema.parse(req.body)
    const page = await pagesService.reorderPage(req.params.id, req.userId!, newPosition)
    res.json({ page })
  } catch (error) {
    next(error)
  }
})

export default router
