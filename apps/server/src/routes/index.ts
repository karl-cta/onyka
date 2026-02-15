import { Router, type Router as RouterType } from 'express'
import authRoutes from './auth.routes.js'
import notesRoutes from './notes.routes.js'
import pagesRoutes from './pages.routes.js'
import foldersRoutes from './folders.routes.js'
import tagsRoutes from './tags.routes.js'
import sharesRoutes from './shares.routes.js'
import settingsRoutes from './settings.routes.js'
import statsRoutes from './stats.routes.js'
import recapsRoutes from './recaps.routes.js'
import commentsRoutes from './comments.routes.js'
import sparksRoutes from './sparks.routes.js'
import usersRoutes from './users.routes.js'
import adminRoutes from './admin.routes.js'
import uploadsRoutes from './uploads.routes.js'
import exportRoutes from './export.routes.js'

const router: RouterType = Router()

router.use('/auth', authRoutes)
router.use('/notes', notesRoutes)
router.use('/pages', pagesRoutes)
router.use('/folders', foldersRoutes)
router.use('/tags', tagsRoutes)
router.use('/shares', sharesRoutes)
router.use('/settings', settingsRoutes)
router.use('/stats', statsRoutes)
router.use('/recaps', recapsRoutes)
router.use('/comments', commentsRoutes)
router.use('/sparks', sparksRoutes)
router.use('/users', usersRoutes)
router.use('/admin', adminRoutes)
router.use('/uploads', uploadsRoutes)
router.use('/export', exportRoutes)

export default router
