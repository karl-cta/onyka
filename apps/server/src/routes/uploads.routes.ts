import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { extname } from 'path'
import { nanoid } from 'nanoid'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import {
  uploadsService,
  validateImageFile,
  validateFileContent,
  processUploadedFile,
  getUploadPath,
  deleteUploadedFile,
  deleteTrackedUpload,
  trackUpload,
  getUploadOwner,
  getUploadsDir,
  getMaxImageSizeBytes,
  checkUserQuota,
  encryptUploadedFile,
  readDecryptedFile,
} from '../services/uploads.service.js'
import { shareRepository } from '../repositories/share.repository.js'

const router: Router = Router()

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir())
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    const id = nanoid(16)
    cb(null, `${id}${ext}`)
  },
})

// Configure multer upload
const upload = multer({
  storage,
  limits: {
    fileSize: getMaxImageSizeBytes(),
    files: 1, // Single file upload
  },
  fileFilter: (_req, file, cb) => {
    if (uploadsService.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  },
})

// Rate limit: 120 file reads per minute per IP
const downloadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
})

// Rate limit: 20 uploads per hour per user
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as Request).userId || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads, please try again later' } },
})

/**
 * POST /api/uploads
 * Upload an image file
 * Requires authentication
 */
router.post(
  '/',
  authenticate,
  uploadRateLimit,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { code: 'NO_FILE', message: 'No file provided' },
        })
      }

      // Validate file metadata (MIME type, extension, size)
      const validationError = validateImageFile(req.file)
      if (validationError) {
        deleteUploadedFile(req.file.filename)
        return res.status(400).json({ error: validationError })
      }

      // Validate file content via magic bytes
      const contentError = await validateFileContent(req.file)
      if (contentError) {
        deleteUploadedFile(req.file.filename)
        return res.status(400).json({ error: contentError })
      }

      // Check user storage quota
      const quotaError = await checkUserQuota(req.userId!, req.file.size)
      if (quotaError) {
        deleteUploadedFile(req.file.filename)
        return res.status(413).json({ error: quotaError })
      }

      // Encrypt the file on disk (AES-256-GCM, same key as note content)
      encryptUploadedFile(req.file.filename)

      // Track ownership in database
      await trackUpload(req.file, req.userId!)

      // Process and return result
      const result = processUploadedFile(req.file)
      res.status(201).json({ upload: result })
    } catch (err) {
      console.error('Upload error:', err)
      res.status(500).json({
        error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' },
      })
    }
  }
)

/**
 * GET /api/uploads/:filename
 * Serve an uploaded file
 * Requires authentication. Access granted if:
 *   1. User owns the image
 *   2. User is admin
 *   3. Image owner has shared any note with this user
 */
router.get('/:filename', authenticate, downloadRateLimit, async (req, res) => {
  const { filename } = req.params
  const userId = req.userId!
  const isAdmin = req.user?.role === 'admin'

  const filePath = getUploadPath(filename)
  if (!filePath) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'File not found' },
    })
  }

  // Check access: owner, admin, or shared relationship
  const ownerId = await getUploadOwner(filename)
  if (ownerId && ownerId !== userId && !isAdmin) {
    const hasShare = await shareRepository.hasAnyShareFromOwner(userId, ownerId)
    if (!hasShare) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      })
    }
  }

  // Decrypt and serve the file
  const decryptedBuffer = readDecryptedFile(filePath)

  // Determine content type from extension
  const ext = extname(filename).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }

  const contentType = contentTypes[ext] || 'application/octet-stream'

  res.set({
    'Content-Type': contentType,
    'Content-Length': String(decryptedBuffer.length),
    'Cache-Control': 'private, max-age=31536000, immutable',
  })

  res.send(decryptedBuffer)
})

/**
 * DELETE /api/uploads/:filename
 * Delete an uploaded file
 * Requires authentication + ownership (or admin)
 */
router.delete('/:filename', authenticate, async (req, res) => {
  const { filename } = req.params
  const userId = req.userId!
  const isAdmin = req.user?.role === 'admin'

  // Check ownership
  const ownerId = await getUploadOwner(filename)
  if (ownerId && ownerId !== userId && !isAdmin) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You do not own this file' },
    })
  }

  const deleted = await deleteTrackedUpload(filename)
  if (!deleted) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'File not found' },
    })
  }

  res.status(204).send()
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
