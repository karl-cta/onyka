import { randomBytes } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { eq } from 'drizzle-orm'
import { tokenService } from '../services/token.service.js'
import { settingsService } from '../services/settings.service.js'
import { passwordService } from '../services/password.service.js'
import { userRepository } from '../repositories/index.js'
import { db, schema } from '../db/index.js'
import { logger } from '../utils/index.js'
import type { User } from '@onyka/shared'

declare global {
  namespace Express {
    interface Request {
      user?: User
      userId?: string
    }
  }
}

let cachedDefaultUser: User | null = null

/** Invalidate the cached default user (call after preference updates in AUTH_DISABLED mode). */
export function invalidateDefaultUserCache(): void {
  cachedDefaultUser = null
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authDisabled = await settingsService.isAuthDisabled()

    if (authDisabled) {
      const defaultUser = await getOrCreateDefaultUser()
      req.user = defaultUser
      req.userId = defaultUser.id
      return next()
    }

    const token = extractToken(req)

    if (!token) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
      return
    }

    const payload = await tokenService.verifyAccessToken(token)

    if (!payload) {
      res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      })
      return
    }

    const user = await userRepository.findById(payload.sub)

    if (!user) {
      res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' },
      })
      return
    }

    if (user.isDisabled) {
      res.status(403).json({
        error: { code: 'ACCOUNT_DISABLED', message: 'Your account has been disabled' },
      })
      return
    }

    req.user = user
    req.userId = user.id
    next()
  } catch (error) {
    next(error)
  }
}

export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authDisabled = await settingsService.isAuthDisabled()

    if (authDisabled) {
      const defaultUser = await getOrCreateDefaultUser()
      req.user = defaultUser
      req.userId = defaultUser.id
      return next()
    }

    const token = extractToken(req)
    if (!token) return next()

    const payload = await tokenService.verifyAccessToken(token)
    if (payload) {
      const user = await userRepository.findById(payload.sub)
      if (user && !user.isDisabled) {
        req.user = user
        req.userId = user.id
      }
    }

    next()
  } catch {
    next()
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.userId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
    return
  }
  next()
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return req.cookies?.access_token ?? null
}

/**
 * System user for AUTH_DISABLED mode. A real DB record is needed for FK constraints.
 * Password is a random 64-byte Argon2 hash, safe even if auth is later re-enabled.
 */
export const SYSTEM_USERNAME = 'onyka-system'

async function getOrCreateDefaultUser(): Promise<User> {
  if (cachedDefaultUser) return cachedDefaultUser

  // Support legacy 'default' username from older installs
  let user = await userRepository.findByUsername(SYSTEM_USERNAME)
    ?? await userRepository.findByUsername('default')

  if (!user) {
    const randomPassword = randomBytes(64).toString('hex')
    const passwordHash = await passwordService.hash(randomPassword)

    user = await userRepository.create({
      username: SYSTEM_USERNAME,
      name: 'Onyka',
      passwordHash,
      role: 'admin',
    })

    logger.info('System user created for AUTH_DISABLED mode')
  } else if (user.role !== 'admin') {
    await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, user.id))
    user = { ...user, role: 'admin' }
  }

  cachedDefaultUser = user
  return user
}
