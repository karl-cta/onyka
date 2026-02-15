import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { extname } from 'path'
import multer from 'multer'
import { nanoid } from 'nanoid'
import { userRepository } from '../repositories/user.repository.js'
import { authenticate, invalidateDefaultUserCache } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import {
  uploadsService,
  validateImageFile,
  validateFileContent,
  processUploadedFile,
  getUploadsDir,
  getMaxImageSizeBytes,
  deleteUploadedFile,
} from '../services/uploads.service.js'

const router: RouterType = Router()

router.use(authenticate)

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir())
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    const id = nanoid(16)
    cb(null, `avatar-${id}${ext}`)
  },
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: getMaxImageSizeBytes(),
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (uploadsService.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  },
})

const searchQuerySchema = z.object({
  q: z.string().min(1).max(50),
})

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  accentColor: z.string().min(1).max(50).optional(),
  avatarColor: z.string().min(1).max(50).optional(),
  editorFontSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']).optional(),
  editorFontFamily: z.string().min(1).max(100).optional(),
  darkThemeBase: z.string().min(1).max(50).optional(),
  lightThemeBase: z.string().min(1).max(50).optional(),
  sidebarCollapsed: z.boolean().optional(),
  sidebarWidth: z.number().int().min(200).max(600).optional(),
  tagsCollapsed: z.boolean().optional(),
  tagsSectionHeight: z.number().int().min(40).max(400).optional(),
  sharedCollapsed: z.boolean().optional(),
  sharedSectionHeight: z.number().int().min(40).max(400).optional(),
})

/**
 * GET /users/search?q=query
 * Search users by username for sharing/collaboration
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = searchQuerySchema.parse(req.query)
    const users = await userRepository.searchByUsername(q, req.userId!, 10)
    res.json({ users })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /users/me/preferences
 * Update current user's preferences
 */
router.patch('/me/preferences', async (req, res, next) => {
  try {
    const prefs = updatePreferencesSchema.parse(req.body)

    // Ensure at least one preference is provided
    if (Object.keys(prefs).length === 0) {
      return res.status(400).json({ error: 'At least one preference must be provided' })
    }

    const user = await userRepository.updatePreferences(req.userId!, prefs)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Invalidate cache for AUTH_DISABLED mode
    invalidateDefaultUserCache()

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /users/me/avatar
 * Upload user avatar
 */
router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'No file provided' },
      })
    }

    // Validate file type (MIME + extension)
    const validationError = validateImageFile(req.file)
    if (validationError) {
      deleteUploadedFile(req.file.filename)
      return res.status(400).json({ error: validationError })
    }

    // Validate file content (magic bytes)
    const contentError = await validateFileContent(req.file)
    if (contentError) {
      deleteUploadedFile(req.file.filename)
      return res.status(400).json({ error: contentError })
    }

    // Delete old avatar if exists
    const oldAvatarUrl = await userRepository.getAvatarUrl(req.userId!)
    if (oldAvatarUrl) {
      const oldFilename = oldAvatarUrl.split('/').pop()
      if (oldFilename) {
        deleteUploadedFile(oldFilename)
      }
    }

    // Process and get URL
    const result = processUploadedFile(req.file)

    // Update user avatarUrl
    const user = await userRepository.setAvatarUrl(req.userId!, result.url)

    // Invalidate cache for AUTH_DISABLED mode
    invalidateDefaultUserCache()

    res.status(200).json({ user, avatarUrl: result.url })
  } catch (err) {
    logger.error('Avatar upload error', err instanceof Error ? err : undefined)
    res.status(500).json({
      error: { code: 'UPLOAD_FAILED', message: 'Failed to upload avatar' },
    })
  }
})

/**
 * DELETE /users/me/avatar
 * Remove user avatar
 */
router.delete('/me/avatar', async (req, res, next) => {
  try {
    const currentAvatarUrl = await userRepository.getAvatarUrl(req.userId!)

    if (currentAvatarUrl) {
      const filename = currentAvatarUrl.split('/').pop()
      if (filename) {
        deleteUploadedFile(filename)
      }
    }

    const user = await userRepository.setAvatarUrl(req.userId!, null)

    // Invalidate cache for AUTH_DISABLED mode
    invalidateDefaultUserCache()

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// Error handler for multer errors
router.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File too large. Maximum size is 5MB',
          },
        })
      }
      return res.status(400).json({
        error: { code: 'UPLOAD_ERROR', message: err.message },
      })
    }
    if (err.message === 'Invalid file type') {
      return res.status(400).json({
        error: {
          code: 'INVALID_TYPE',
          message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
        },
      })
    }
    next(err)
  }
)

export default router
