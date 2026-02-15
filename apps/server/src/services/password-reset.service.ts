import crypto from 'crypto'
import { userRepository, passwordResetRepository } from '../repositories/index.js'
import { passwordService } from './password.service.js'
import { tokenService } from './token.service.js'
import { emailService } from './email.service.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error.js'

const TOKEN_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes
const MIN_REQUEST_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes between requests

export class PasswordResetError extends AppError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message, code, statusCode)
    this.name = 'PasswordResetError'
  }
}

export class PasswordResetService {
  /**
   * Request a password reset. Never reveals if user exists.
   */
  async requestReset(identifier: string): Promise<void> {
    const user = await userRepository.findByEmailOrUsername(identifier)

    // Prevent timing attacks
    await this.delay(100 + Math.random() * 200)

    if (!user || !user.email) {
      return
    }

    const recentToken = await passwordResetRepository.findActiveByUser(user.id)
    if (recentToken) {
      const timeSinceCreation = Date.now() - recentToken.createdAt.getTime()
      if (timeSinceCreation < MIN_REQUEST_INTERVAL_MS) {
        return
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    await passwordResetRepository.create(user.id, tokenHash, expiresAt)

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`
    emailService
      .sendPasswordReset(user.email, {
        username: user.username,
        resetUrl,
        expiresInMinutes: 30,
      })
      .catch((err) => {
        console.error('Failed to send password reset email:', err)
      })
  }

  /**
   * Confirm password reset with token
   */
  async confirmReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token)

    const resetToken = await passwordResetRepository.findValidByHash(tokenHash)
    if (!resetToken) {
      throw new PasswordResetError('Invalid or expired token', 'INVALID_TOKEN')
    }

    const validation = passwordService.validateStrength(newPassword)
    if (!validation.valid) {
      throw new PasswordResetError(validation.message!, 'WEAK_PASSWORD')
    }

    const passwordHash = await passwordService.hash(newPassword)
    await userRepository.updatePasswordHash(resetToken.userId, passwordHash)
    await passwordResetRepository.markAsUsed(resetToken.id)
    await passwordResetRepository.invalidateAllForUser(resetToken.userId)
    await tokenService.revokeAllUserTokens(resetToken.userId)
  }

  /**
   * Admin-initiated password reset. Sends reset email to user with verified email.
   */
  async adminRequestReset(userId: string): Promise<void> {
    const user = await userRepository.findById(userId)

    if (!user) {
      throw new PasswordResetError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (!user.email || !user.emailVerified) {
      throw new PasswordResetError('User has no verified email', 'NO_VERIFIED_EMAIL')
    }

    if (!emailService.isConfigured()) {
      throw new PasswordResetError('Email service not configured', 'EMAIL_NOT_CONFIGURED', 503)
    }

    await passwordResetRepository.invalidateAllForUser(userId)

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    await passwordResetRepository.create(userId, tokenHash, expiresAt)

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`
    await emailService.sendPasswordReset(user.email, {
      username: user.username,
      resetUrl,
      expiresInMinutes: 30,
    })
  }

  /**
   * Check if email service is available
   */
  isEmailConfigured(): boolean {
    return emailService.isConfigured()
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const passwordResetService = new PasswordResetService()
