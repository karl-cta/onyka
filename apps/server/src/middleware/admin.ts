import type { Request, Response, NextFunction } from 'express'
import { AppError } from './error.js'

/** Requires admin role. Must be used after authenticate middleware. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    })
    return
  }

  if (req.user.isDisabled) {
    res.status(403).json({
      error: { code: 'ACCOUNT_DISABLED', message: 'Your account has been disabled' },
    })
    return
  }

  next()
}

export class AdminError extends AppError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message, code, statusCode)
    this.name = 'AdminError'
  }
}
