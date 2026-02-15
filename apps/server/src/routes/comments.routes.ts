import { Router, type Request, type Router as RouterType } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { commentsService } from '../services/comments.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

// Rate limit: 30 comments per hour per user
const createCommentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as Request).userId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many comments, please try again later' } },
})

const createCommentSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  parentId: z.string().optional(),
})

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
})

// Get comments for a note
router.get('/note/:noteId', async (req, res, next) => {
  try {
    const comments = await commentsService.getComments(req.params.noteId, req.userId!)
    res.json({ comments })
  } catch (error) {
    next(error)
  }
})

// Get comment count for a note
router.get('/note/:noteId/count', async (req, res, next) => {
  try {
    const count = await commentsService.getCommentCount(req.params.noteId, req.userId!)
    res.json({ count })
  } catch (error) {
    next(error)
  }
})

// Create a comment
router.post('/', createCommentRateLimit, async (req, res, next) => {
  try {
    const input = createCommentSchema.parse(req.body)
    const comment = await commentsService.createComment(
      input.noteId,
      req.userId!,
      input.content,
      input.parentId
    )
    res.status(201).json({ comment })
  } catch (error) {
    next(error)
  }
})

// Update a comment
router.patch('/:id', async (req, res, next) => {
  try {
    const { content } = updateCommentSchema.parse(req.body)
    const comment = await commentsService.updateComment(req.params.id, req.userId!, content)
    res.json({ comment })
  } catch (error) {
    next(error)
  }
})

// Delete a comment
router.delete('/:id', async (req, res, next) => {
  try {
    await commentsService.deleteComment(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
