import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { AuthError } from '../services/auth.service.js'
import { NotesServiceError } from '../services/notes.service.js'
import { FoldersServiceError } from '../services/folders.service.js'
import { TagsServiceError } from '../services/tags.service.js'
import { SharingServiceError } from '../services/sharing.service.js'
import { TwoFactorError } from '../services/two-factor.service.js'
import { EmailVerificationError } from '../services/email-verification.service.js'
import { ExportServiceError } from '../services/export.service.js'
import { SparksServiceError } from '../services/sparks.service.js'
import { logger } from '../utils/logger.js'

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', err, { path: req.path, method: req.method })

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof AuthError) {
    if (err.statusCode === 429 && err.rateLimitInfo?.retryAfter) {
      res.set('Retry-After', String(err.rateLimitInfo.retryAfter))
    }
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        rateLimitInfo: err.rateLimitInfo,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof NotesServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof FoldersServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof TagsServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof SharingServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof TwoFactorError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof EmailVerificationError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof ExportServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof SparksServiceError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {}
    err.errors.forEach((e) => {
      const path = e.path.join('.')
      if (!details[path]) details[path] = []
      details[path].push(e.message)
    })

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  })
}
