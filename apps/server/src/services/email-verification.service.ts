import crypto from 'crypto'
import { userRepository, emailVerificationRepository } from '../repositories/index.js'
import { emailService } from './email.service.js'
import { env } from '../config/env.js'

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours for email verification

export class EmailVerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'EmailVerificationError'
  }
}

export class EmailVerificationService {
  /**
   * Generate a cryptographically secure token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * Send verification email to user
   */
  async sendVerification(userId: string, email?: string): Promise<{ sent: boolean }> {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new EmailVerificationError('User not found', 'USER_NOT_FOUND', 404)
    }

    const targetEmail = email || user.email
    if (!targetEmail) {
      throw new EmailVerificationError('No email address provided', 'NO_EMAIL', 400)
    }

    if (!email && user.emailVerified) {
      throw new EmailVerificationError('Email already verified', 'ALREADY_VERIFIED', 400)
    }

    const token = this.generateToken()
    const tokenHash = this.hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    await emailVerificationRepository.create(userId, targetEmail, tokenHash, expiresAt)

    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`

    const sent = await emailService.sendEmailVerification(targetEmail, {
      username: user.username,
      verificationUrl,
      expiresInMinutes: Math.round(TOKEN_EXPIRY_MS / 60000),
    })

    return { sent }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ userId: string; email: string }> {
    const tokenHash = this.hashToken(token)
    const verificationToken = await emailVerificationRepository.findValidByHash(tokenHash)

    if (!verificationToken) {
      throw new EmailVerificationError('Invalid or expired verification token', 'INVALID_TOKEN', 400)
    }

    await userRepository.setEmail(verificationToken.userId, verificationToken.email)
    await userRepository.setEmailVerified(verificationToken.userId, true)
    await emailVerificationRepository.delete(verificationToken.id)

    return {
      userId: verificationToken.userId,
      email: verificationToken.email,
    }
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured(): boolean {
    return emailService.isConfigured()
  }
}

export const emailVerificationService = new EmailVerificationService()
