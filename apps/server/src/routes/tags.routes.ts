import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { tagsService } from '../services/tags.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
})

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
})

const listTagsSchema = z.object({
  withCounts: z.enum(['true', 'false']).optional(),
})

router.get('/', async (req, res, next) => {
  try {
    const { withCounts } = listTagsSchema.parse(req.query)

    if (withCounts === 'true') {
      const tags = await tagsService.listWithCounts(req.userId!)
      return res.json({ tags })
    }

    const tags = await tagsService.list(req.userId!)
    res.json({ tags })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createTagSchema.parse(req.body)
    const tag = await tagsService.create(req.userId!, input)
    res.status(201).json({ tag })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const tag = await tagsService.getById(req.params.id, req.userId!)
    res.json({ tag })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const input = updateTagSchema.parse(req.body)
    const tag = await tagsService.update(req.params.id, req.userId!, input)
    res.json({ tag })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await tagsService.delete(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
