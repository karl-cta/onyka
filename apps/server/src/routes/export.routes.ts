import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { exportService, type ExportFormat } from '../services/export.service.js'
import { authenticate } from '../middleware/auth.js'

const router: RouterType = Router()

router.use(authenticate)

const exportNoteQuerySchema = z.object({
  format: z.enum(['md', 'txt', 'html']).default('md'),
})

router.get('/note/:id', async (req, res, next) => {
  try {
    const { format } = exportNoteQuerySchema.parse(req.query)
    const result = await exportService.exportNote(req.params.id, req.userId!, format as ExportFormat)

    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`)
    res.send(result.content)
  } catch (error) {
    next(error)
  }
})

router.get('/folder/:id', async (req, res, next) => {
  try {
    const { format } = exportNoteQuerySchema.parse(req.query)
    const { stream, filename } = await exportService.exportFolder(req.params.id, req.userId!, format as ExportFormat)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    stream.pipe(res)
  } catch (error) {
    next(error)
  }
})

export default router
