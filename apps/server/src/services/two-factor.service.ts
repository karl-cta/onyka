import crypto from 'crypto'
import { userRepository, twoFactorRepository, trustedDeviceRepository, type OtpPurpose } from '../repositories/index.js'
import { recoveryCodeService } from './recovery-code.service.js'
import { passwordService } from './password.service.js'
import { emailService } from './email.service.js'

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const OTP_LENGTH = 6
const OTP_MAX_ATTEMPTS = 5
const TRUSTED_DEVICE_DAYS = 30

export class TwoFactorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'TwoFactorError'
  }
}

export class TwoFactorService {
  /**
   * Generate a random 6-digit OTP code
   */
  private generateOtpCode(): string {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(4)
    const randomNumber = randomBytes.readUInt32BE(0) % 1000000
    return randomNumber.toString().padStart(OTP_LENGTH, '0')
  }

  /**
   * Hash OTP code for secure storage
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  /**
   * Send OTP code via email
   */
  async sendOtpCode(userId: string, purpose: OtpPurpose): Promise<{ sent: boolean; waitSeconds?: number }> {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new TwoFactorError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (!user.email) {
      throw new TwoFactorError('No email address configured', 'NO_EMAIL', 400)
    }

    // Check if email is verified (required for 2FA)
    if (!user.emailVerified) {
      throw new TwoFactorError('Email not verified', 'EMAIL_NOT_VERIFIED', 400)
    }

    // Check rate limit
    const waitSeconds = await twoFactorRepository.getTimeUntilNextCode(userId, purpose)
    if (waitSeconds > 0) {
      return { sent: false, waitSeconds }
    }

    // Generate code
    const code = this.generateOtpCode()
    const codeHash = this.hashCode(code)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

    // Store hashed code
    await twoFactorRepository.createOtpCode(userId, codeHash, purpose, expiresAt)

    // Send email
    const sent = await this.sendOtpEmail(user.email, user.username, code, purpose)

    return { sent }
  }

  /**
   * Send OTP email based on purpose
   */
  private async sendOtpEmail(email: string, username: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const subjects = {
      login: 'Your Onyka login code',
      enable_2fa: 'Confirm 2FA activation',
      disable_2fa: 'Confirm 2FA deactivation',
    }

    const messages = {
      login: 'Use this code to complete your login:',
      enable_2fa: 'Use this code to enable two-factor authentication:',
      disable_2fa: 'Use this code to disable two-factor authentication:',
    }

    const subject = subjects[purpose]
    const message = messages[purpose]

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #171717; border-radius: 16px; padding: 32px; border: 1px solid #262626;">
    <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0; color: #fafafa;">Verification Code</h1>

    <p style="color: #a1a1aa; margin: 0 0 16px 0; line-height: 1.6;">
      Hi ${username},
    </p>

    <p style="color: #a1a1aa; margin: 0 0 24px 0; line-height: 1.6;">
      ${message}
    </p>

    <div style="background: #262626; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #fafafa;">${code}</span>
    </div>

    <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
      This code expires in 10 minutes.
    </p>

    <p style="color: #71717a; font-size: 14px; margin: 0;">
      If you didn't request this code, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #262626; margin: 32px 0;">

    <p style="color: #52525b; font-size: 12px; margin: 0;">
      Onyka - Your private notes
    </p>
  </div>
</body>
</html>
`

    const text = `
${subject}

Hi ${username},

${message}

${code}

This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.

- Onyka
`

    return emailService.send({ to: email, subject, html, text })
  }

  /**
   * Verify OTP code
   */
  async verifyCode(userId: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const storedCode = await twoFactorRepository.findValidCode(userId, purpose)
    if (!storedCode) {
      return false
    }

    // Block brute-force: invalidate code after max attempts
    if (storedCode.attempts >= OTP_MAX_ATTEMPTS) {
      await twoFactorRepository.invalidateCode(storedCode.id)
      return false
    }

    const codeHash = this.hashCode(code)
    const isValid = storedCode.code === codeHash

    if (!isValid) {
      await twoFactorRepository.incrementAttempts(storedCode.id)
      return false
    }

    // Mark as used
    await twoFactorRepository.markAsUsed(storedCode.id)
    return true
  }

  /**
   * Verify a recovery code for login (consumes the code)
   */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    return recoveryCodeService.useCode(userId, code)
  }

  /**
   * Enable 2FA after code verification
   */
  async enable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new TwoFactorError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (user.twoFactorEnabled) {
      throw new TwoFactorError('2FA is already enabled', '2FA_ALREADY_ENABLED', 400)
    }

    if (!user.email || !user.emailVerified) {
      throw new TwoFactorError('Verified email required for 2FA', 'EMAIL_REQUIRED', 400)
    }

    // Verify the code
    const isValid = await this.verifyCode(userId, code, 'enable_2fa')
    if (!isValid) {
      throw new TwoFactorError('Invalid or expired code', 'INVALID_CODE', 400)
    }

    // Enable 2FA
    await userRepository.set2FAEnabled(userId, true)

    // Generate recovery codes
    const recoveryCodes = await recoveryCodeService.generateForUser(userId)

    return { recoveryCodes }
  }

  /**
   * Disable 2FA (requires password verification and OTP code)
   */
  async disable(userId: string, password: string, code: string): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId)
    if (!user) {
      throw new TwoFactorError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (!user.twoFactorEnabled) {
      throw new TwoFactorError('2FA is not enabled', '2FA_NOT_ENABLED', 400)
    }

    // Verify password
    const isPasswordValid = await passwordService.verify(user.passwordHash, password)
    if (!isPasswordValid) {
      throw new TwoFactorError('Invalid password', 'INVALID_PASSWORD', 400)
    }

    // Verify the code
    const isCodeValid = await this.verifyCode(userId, code, 'disable_2fa')
    if (!isCodeValid) {
      throw new TwoFactorError('Invalid or expired code', 'INVALID_CODE', 400)
    }

    // Disable 2FA
    await userRepository.set2FAEnabled(userId, false)

    // Delete recovery codes
    const { recoveryCodeRepository } = await import('../repositories/index.js')
    await recoveryCodeRepository.deleteAllForUser(userId)
  }

  /**
   * Get 2FA status for a user
   */
  async getStatus(userId: string): Promise<{
    enabled: boolean
    hasVerifiedEmail: boolean
    recoveryCodesRemaining: number
  }> {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new TwoFactorError('User not found', 'USER_NOT_FOUND', 404)
    }

    const recoveryStatus = await recoveryCodeService.getStatus(userId)

    return {
      enabled: user.twoFactorEnabled,
      hasVerifiedEmail: !!user.email && user.emailVerified,
      recoveryCodesRemaining: recoveryStatus.remaining,
    }
  }

  /**
   * Regenerate recovery codes (requires password verification)
   */
  async regenerateRecoveryCodes(userId: string, password: string): Promise<string[]> {
    const user = await userRepository.findByIdWithPassword(userId)
    if (!user) {
      throw new TwoFactorError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (!user.twoFactorEnabled) {
      throw new TwoFactorError('2FA is not enabled', '2FA_NOT_ENABLED', 400)
    }

    // Verify password
    const isValid = await passwordService.verify(user.passwordHash, password)
    if (!isValid) {
      throw new TwoFactorError('Invalid password', 'INVALID_PASSWORD', 400)
    }

    return recoveryCodeService.generateForUser(userId)
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured(): boolean {
    return emailService.isConfigured()
  }

  // ─── Trusted Devices ──────────────────────────────────────────

  /**
   * Generate a trusted device token and store its hash.
   * Returns the raw token (to be set as HttpOnly cookie).
   */
  async createTrustedDevice(
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hashCode(token)
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000)
    const label = metadata?.userAgent ? this.parseUserAgentLabel(metadata.userAgent) : null

    await trustedDeviceRepository.create(userId, tokenHash, expiresAt, {
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      label: label ?? undefined,
    })

    return { token, expiresAt }
  }

  /**
   * Check if a trusted device token is valid for a given user.
   */
  async verifyTrustedDevice(token: string, userId: string): Promise<boolean> {
    const tokenHash = this.hashCode(token)
    const device = await trustedDeviceRepository.findValidByTokenHash(tokenHash)
    return device !== null && device.userId === userId
  }

  /**
   * List trusted devices for a user.
   */
  async listTrustedDevices(userId: string) {
    const devices = await trustedDeviceRepository.findByUser(userId)
    const now = new Date()
    return devices
      .filter((d) => d.expiresAt > now)
      .map((d) => ({
        id: d.id,
        label: d.label || this.parseUserAgentLabel(d.userAgent || '') || 'Unknown device',
        ipAddress: d.ipAddress,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
      }))
  }

  /**
   * Revoke a specific trusted device.
   */
  async revokeTrustedDevice(id: string, userId: string): Promise<boolean> {
    return trustedDeviceRepository.deleteById(id, userId)
  }

  /**
   * Revoke all trusted devices for a user.
   */
  async revokeAllTrustedDevices(userId: string): Promise<number> {
    return trustedDeviceRepository.deleteAllByUser(userId)
  }

  /**
   * Parse a user-agent string into a short label (e.g. "Chrome on Windows").
   */
  private parseUserAgentLabel(ua: string): string | null {
    if (!ua) return null

    let browser = 'Unknown'
    if (ua.includes('Firefox/')) browser = 'Firefox'
    else if (ua.includes('Edg/')) browser = 'Edge'
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome'
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'

    let os = ''
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac OS')) os = 'macOS'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('Linux')) os = 'Linux'

    return os ? `${browser} on ${os}` : browser
  }
}

export const twoFactorService = new TwoFactorService()
