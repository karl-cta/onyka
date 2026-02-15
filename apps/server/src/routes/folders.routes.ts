import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { foldersService } from '../services/folders.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

const createFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  parentId: z.string().nullable().optional(),
})

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(100).optional(),
})

const deleteFolderSchema = z.object({
  cascade: z.enum(['true', 'false']).optional(),
})

const moveNoteSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  folderId: z.string().nullable(),
})

const reorderFolderSchema = z.object({
  folderId: z.string().min(1, 'Folder ID is required'),
  newParentId: z.string().nullable(),
  newPosition: z.number().int().min(0, 'Position must be >= 0'),
})

const reorderNoteSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  newFolderId: z.string().nullable(),
  newPosition: z.number().int().min(0, 'Position must be >= 0'),
})

router.get('/', async (req, res, next) => {
  try {
    const folders = await foldersService.list(req.userId!)
    res.json({ folders })
  } catch (error) {
    next(error)
  }
})

router.get('/tree', async (req, res, next) => {
  try {
    const tree = await foldersService.getTree(req.userId!)
    const rootNotes = await foldersService.getRootNotes(req.userId!)
    res.json({ tree, rootNotes })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createFolderSchema.parse(req.body)
    const folder = await foldersService.create(req.userId!, input)
    res.status(201).json({ folder })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const folder = await foldersService.getById(req.params.id, req.userId!)
    res.json({ folder })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const input = updateFolderSchema.parse(req.body)
    const folder = await foldersService.update(req.params.id, req.userId!, input)
    res.json({ folder })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { cascade } = deleteFolderSchema.parse(req.query)
    await foldersService.delete(req.params.id, req.userId!, cascade === 'true')
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/move-note', async (req, res, next) => {
  try {
    const { noteId, folderId } = moveNoteSchema.parse(req.body)
    await foldersService.moveNote(noteId, folderId, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/reorder', async (req, res, next) => {
  try {
    const input = reorderFolderSchema.parse(req.body)
    const folder = await foldersService.reorderFolder(input, req.userId!)
    res.json({ folder })
  } catch (error) {
    next(error)
  }
})

router.post('/reorder-note', async (req, res, next) => {
  try {
    const input = reorderNoteSchema.parse(req.body)
    const note = await foldersService.reorderNote(input, req.userId!)
    res.json({ note })
  } catch (error) {
    next(error)
  }
})

export default router
