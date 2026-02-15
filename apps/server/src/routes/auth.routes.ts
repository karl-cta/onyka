import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authService, AuthError } from '../services/auth.service.js'
import { tokenService } from '../services/token.service.js'
import { settingsService } from '../services/settings.service.js'
import { statsService } from '../services/stats.service.js'
import { passwordResetService } from '../services/password-reset.service.js'
import { twoFactorService } from '../services/two-factor.service.js'
import { recoveryCodeService } from '../services/recovery-code.service.js'
import { emailVerificationService } from '../services/email-verification.service.js'
import { userRepository } from '../repositories/user.repository.js'
import { authenticate } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const router: RouterType = Router()

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128, 'Password too long'),
  email: z.preprocess((val) => (val === '' ? undefined : val), z.string().email('Invalid email').optional()),
})

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(30, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
  rememberMe: z.boolean().default(false),
})

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

const TRUSTED_DEVICE_COOKIE = 'trusted_device'
const TRUSTED_DEVICE_DAYS = 30

router.post('/register', async (req, res, next) => {
  try {
    const settings = await settingsService.get()
    if (settings.authDisabled) {
      res.status(403).json({
        error: { code: 'AUTH_DISABLED', message: 'Registration is not available when authentication is disabled' },
      })
      return
    }
    if (!settings.allowRegistration) {
      res.status(403).json({
        error: { code: 'REGISTRATION_DISABLED', message: 'Registration is currently disabled' },
      })
      return
    }

    const input = registerSchema.parse(req.body)

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    }
    const result = await authService.register(input, metadata)

    res.cookie('access_token', result.tokens!.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: result.tokens!.expiresIn * 1000,
    })
    res.cookie('refresh_token', result.tokens!.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    })

    res.status(201).json({
      user: result.user,
      tokens: {
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn,
      },
    })
  } catch (error) {
    next(error)
  }
})

const REFRESH_TOKEN_SHORT_DAYS = 1
const REFRESH_TOKEN_LONG_DAYS = env.JWT_REFRESH_EXPIRY_DAYS

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const { rememberMe } = input

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress,
    }

    const result = await authService.login(input, ipAddress, rememberMe, metadata)

    if (result.requires2FA) {
      // Check if this device is trusted (skip 2FA)
      const trustedDeviceToken = req.cookies?.[TRUSTED_DEVICE_COOKIE]
      if (trustedDeviceToken && result.userId) {
        try {
          const isTrusted = await twoFactorService.verifyTrustedDevice(trustedDeviceToken, result.userId)
          if (isTrusted) {
            // Trusted device — complete login without 2FA
            const completeResult = await authService.completeLoginAfter2FA(result.userId, rememberMe, metadata)
            const refreshExpiryDays = rememberMe ? REFRESH_TOKEN_LONG_DAYS : REFRESH_TOKEN_SHORT_DAYS

            res.cookie('access_token', completeResult.tokens!.accessToken, {
              ...COOKIE_OPTIONS,
              maxAge: completeResult.tokens!.expiresIn * 1000,
            })
            res.cookie('refresh_token', completeResult.tokens!.refreshToken, {
              ...COOKIE_OPTIONS,
              maxAge: refreshExpiryDays * 24 * 60 * 60 * 1000,
            })

            res.json({
              user: completeResult.user,
              tokens: {
                accessToken: completeResult.tokens!.accessToken,
                refreshToken: completeResult.tokens!.refreshToken,
                expiresIn: completeResult.tokens!.expiresIn,
              },
            })
            return
          }
        } catch {
          // Trusted device check failed — clear invalid cookie, fall through to 2FA
          res.clearCookie(TRUSTED_DEVICE_COOKIE, COOKIE_OPTIONS)
        }
      }

      res.json({
        requires2FA: true,
        userId: result.userId,
        rememberMe,
      })
      return
    }

    const refreshExpiryDays = rememberMe ? REFRESH_TOKEN_LONG_DAYS : REFRESH_TOKEN_SHORT_DAYS

    res.cookie('access_token', result.tokens!.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: result.tokens!.expiresIn * 1000,
    })
    res.cookie('refresh_token', result.tokens!.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: refreshExpiryDays * 24 * 60 * 60 * 1000,
    })

    res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token

    if (refreshToken) {
      await authService.logout(refreshToken)
    }

    res.clearCookie('access_token', COOKIE_OPTIONS)
    res.clearCookie('refresh_token', COOKIE_OPTIONS)

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    await authService.logoutAll(req.userId!)
    await twoFactorService.revokeAllTrustedDevices(req.userId!)

    res.clearCookie('access_token', COOKIE_OPTIONS)
    res.clearCookie('refresh_token', COOKIE_OPTIONS)
    res.clearCookie(TRUSTED_DEVICE_COOKIE, COOKIE_OPTIONS)

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token

    if (!refreshToken) {
      throw new AuthError('Refresh token required', 'MISSING_REFRESH_TOKEN', 400)
    }

    const refreshMetadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    }
    const tokens = await authService.refreshTokens(refreshToken, refreshMetadata)

    res.cookie('access_token', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: tokens.expiresIn * 1000,
    })
    res.cookie('refresh_token', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    })

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user })
})

const updateProfileSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(128, 'Password too long').optional(),
}).refine(
  (data) => {
    if (data.newPassword && !data.currentPassword) {
      return false
    }
    return true
  },
  { message: 'Current password is required to change password', path: ['currentPassword'] }
)

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body)
    const result = await authService.updateProfile(req.userId!, input)
    res.json({ user: result })
  } catch (error) {
    next(error)
  }
})

router.get('/status', async (req, res, next) => {
  try {
    const settings = await settingsService.get()
    res.json({
      authEnabled: !settings.authDisabled,
      allowRegistration: settings.allowRegistration,
      authenticated: !!req.cookies?.access_token,
    })
  } catch (error) {
    next(error)
  }
})

// --- Onboarding ---

router.patch('/onboarding/complete', authenticate, async (req, res, next) => {
  try {
    await userRepository.setOnboardingCompleted(req.userId!)
    res.json({ onboardingCompleted: true })
  } catch (error) {
    next(error)
  }
})

router.get('/tracking', authenticate, async (req, res, next) => {
  try {
    const enabled = await userRepository.getTrackingEnabled(req.userId!)
    res.json({ trackingEnabled: enabled })
  } catch (error) {
    next(error)
  }
})

const trackingSchema = z.object({
  enabled: z.boolean(),
})

router.patch('/tracking', authenticate, async (req, res, next) => {
  try {
    const { enabled } = trackingSchema.parse(req.body)

    if (!enabled) {
      await statsService.resetStats(req.userId!)
    }

    await userRepository.setTrackingEnabled(req.userId!, enabled)
    res.json({ trackingEnabled: enabled })
  } catch (error) {
    next(error)
  }
})

router.get('/language', authenticate, async (req, res, next) => {
  try {
    const language = await userRepository.getLanguage(req.userId!)
    res.json({ language })
  } catch (error) {
    next(error)
  }
})

const languageSchema = z.object({
  language: z.enum(['en', 'fr']),
})

router.patch('/language', authenticate, async (req, res, next) => {
  try {
    const { language } = languageSchema.parse(req.body)
    await userRepository.setLanguage(req.userId!, language)
    res.json({ language })
  } catch (error) {
    next(error)
  }
})

// --- Password Reset ---

const passwordResetRequestSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
})

const passwordResetConfirmSchema = z.object({
  token: z.string().length(64, 'Invalid token'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(128, 'Password too long'),
})

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { identifier } = passwordResetRequestSchema.parse(req.body)
    await passwordResetService.requestReset(identifier)

    res.json({
      message: 'If an account exists with that username or email, a reset link has been sent.',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const { token, newPassword } = passwordResetConfirmSchema.parse(req.body)

    await passwordResetService.confirmReset(token, newPassword)

    res.json({ message: 'Password has been reset successfully. Please login with your new password.' })
  } catch (error) {
    next(error)
  }
})

router.get('/password-reset/status', async (_req, res) => {
  res.json({
    available: passwordResetService.isEmailConfigured(),
  })
})

// --- 2FA ---

const twoFactorCodeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numbers only'),
})

const twoFactorVerifyLoginSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  code: z.string().min(1, 'Code is required'),
  isRecoveryCode: z.boolean().default(false),
  rememberMe: z.boolean().default(false),
  trustDevice: z.boolean().default(false),
})

const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numbers only'),
})

const twoFactorSendCodeSchema = z.object({
  purpose: z.enum(['enable_2fa', 'disable_2fa']),
})

router.post('/2fa/send-code', authenticate, async (req, res, next) => {
  try {
    const { purpose } = twoFactorSendCodeSchema.parse(req.body)

    const result = await twoFactorService.sendOtpCode(req.userId!, purpose)

    if (!result.sent && result.waitSeconds) {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Please wait before requesting another code' },
        waitSeconds: result.waitSeconds,
      })
      return
    }

    res.json({
      sent: result.sent,
      message: result.sent ? 'Verification code sent to your email' : 'Failed to send code',
    })
  } catch (error) {
    next(error)
  }
})

const sendLoginCodeIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many code requests, please try again later' } },
})

// Rate limit send-login-code by userId in body (max 3 per 15 min)
const sendLoginCodeUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `2fa-login:${req.body?.userId || req.ip}`,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many code requests for this user, please try again later' } },
})

/**
 * POST /api/auth/2fa/send-login-code
 * Send OTP code for login (no auth required, uses userId).
 */
router.post('/2fa/send-login-code', sendLoginCodeIpLimiter, sendLoginCodeUserLimiter, async (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body)

    logger.info('[2FA] send-login-code requested', { userId: userId.substring(0, 8) })

    const result = await twoFactorService.sendOtpCode(userId, 'login')

    if (!result.sent && result.waitSeconds) {
      logger.info('[2FA] rate-limited', { waitSeconds: result.waitSeconds })
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Please wait before requesting another code' },
        waitSeconds: result.waitSeconds,
      })
      return
    }

    logger.info('[2FA] send-login-code result', { sent: result.sent })

    res.json({
      sent: result.sent,
      message: result.sent ? 'Verification code sent to your email' : 'Failed to send code',
    })
  } catch (error) {
    logger.error('[2FA] send-login-code error', error instanceof Error ? error : undefined)
    next(error)
  }
})

/**
 * POST /api/auth/2fa/enable
 * Enable 2FA after verifying email code.
 * Requires authentication.
 */
router.post('/2fa/enable', authenticate, async (req, res, next) => {
  try {
    const { code } = twoFactorCodeSchema.parse(req.body)

    const result = await twoFactorService.enable(req.userId!, code)

    res.json({
      message: '2FA has been enabled',
      recoveryCodes: result.recoveryCodes,
    })
  } catch (error) {
    next(error)
  }
})

// Rate limit 2FA verify: 10 attempts per 15 minutes per IP
const verify2faRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many verification attempts, please try again later' } },
})

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code during login.
 */
router.post('/2fa/verify', verify2faRateLimit, async (req, res, next) => {
  try {
    const { userId, code, isRecoveryCode, rememberMe, trustDevice } = twoFactorVerifyLoginSchema.parse(req.body)

    let isValid: boolean

    if (isRecoveryCode) {
      isValid = await twoFactorService.verifyRecoveryCode(userId, code)
    } else {
      isValid = await twoFactorService.verifyCode(userId, code, 'login')
    }

    if (!isValid) {
      throw new AuthError('Invalid verification code', 'INVALID_2FA_CODE', 401)
    }

    // Complete the login with rememberMe preference
    const twoFaMetadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    }
    const result = await authService.completeLoginAfter2FA(userId, rememberMe, twoFaMetadata)

    const refreshExpiryDays = rememberMe ? REFRESH_TOKEN_LONG_DAYS : REFRESH_TOKEN_SHORT_DAYS

    res.cookie('access_token', result.tokens!.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: result.tokens!.expiresIn * 1000,
    })
    res.cookie('refresh_token', result.tokens!.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: refreshExpiryDays * 24 * 60 * 60 * 1000,
    })

    // Trust this device if requested
    if (trustDevice) {
      const { token: deviceToken, expiresAt } = await twoFactorService.createTrustedDevice(userId, twoFaMetadata)
      res.cookie(TRUSTED_DEVICE_COOKIE, deviceToken, {
        ...COOKIE_OPTIONS,
        maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000,
        expires: expiresAt,
      })
    }

    res.json({
      user: result.user,
      tokens: {
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA. Requires password and email code verification.
 */
router.post('/2fa/disable', authenticate, async (req, res, next) => {
  try {
    const { password, code } = twoFactorDisableSchema.parse(req.body)

    await twoFactorService.disable(req.userId!, password, code)

    // Revoke all trusted devices when disabling 2FA
    await twoFactorService.revokeAllTrustedDevices(req.userId!)
    res.clearCookie(TRUSTED_DEVICE_COOKIE, COOKIE_OPTIONS)

    res.json({ message: '2FA has been disabled' })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/auth/2fa/status
 * Get 2FA status for current user.
 */
router.get('/2fa/status', authenticate, async (req, res, next) => {
  try {
    const status = await twoFactorService.getStatus(req.userId!)
    res.json(status)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/2fa/regenerate-codes
 * Regenerate recovery codes. Requires password verification.
 */
router.post('/2fa/regenerate-codes', authenticate, async (req, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body)

    const recoveryCodes = await twoFactorService.regenerateRecoveryCodes(req.userId!, password)

    res.json({
      recoveryCodes,
      message: 'Recovery codes have been regenerated',
    })
  } catch (error) {
    next(error)
  }
})

// --- Trusted Devices ---

/**
 * GET /api/auth/trusted-devices
 * List trusted devices for current user.
 */
router.get('/trusted-devices', authenticate, async (req, res, next) => {
  try {
    const devices = await twoFactorService.listTrustedDevices(req.userId!)
    res.json({ devices })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/trusted-devices/:id
 * Revoke a specific trusted device.
 */
router.delete('/trusted-devices/:id', authenticate, async (req, res, next) => {
  try {
    const revoked = await twoFactorService.revokeTrustedDevice(req.params.id, req.userId!)
    if (!revoked) {
      res.status(404).json({
        error: { code: 'DEVICE_NOT_FOUND', message: 'Trusted device not found' },
      })
      return
    }
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/trusted-devices
 * Revoke all trusted devices for current user.
 */
router.delete('/trusted-devices', authenticate, async (req, res, next) => {
  try {
    const revoked = await twoFactorService.revokeAllTrustedDevices(req.userId!)
    res.json({ success: true, revoked })
  } catch (error) {
    next(error)
  }
})

// --- Recovery Codes ---

/**
 * GET /api/auth/recovery-codes/status
 * Get recovery codes status.
 */
router.get('/recovery-codes/status', authenticate, async (req, res, next) => {
  try {
    const status = await recoveryCodeService.getStatus(req.userId!)
    res.json(status)
  } catch (error) {
    next(error)
  }
})

// --- Email Verification ---

const sendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
})

/**
 * POST /api/auth/email/send-verification
 * Send email verification link.
 * If `email` is provided in body, sends verification to that new address.
 * Otherwise verifies the user's current email.
 * Requires authentication.
 */
router.post('/email/send-verification', authenticate, async (req, res, next) => {
  try {
    const { email } = sendVerificationSchema.parse(req.body)

    // If changing email, check uniqueness first
    if (email) {
      const existing = await userRepository.findByEmail(email)
      if (existing && existing.id !== req.userId) {
        res.status(409).json({
          error: { code: 'EMAIL_TAKEN', message: 'This email is already in use' },
        })
        return
      }
    }

    const result = await emailVerificationService.sendVerification(req.userId!, email)

    res.json({
      sent: result.sent,
      message: result.sent ? 'Verification email sent' : 'Failed to send email',
    })
  } catch (error) {
    next(error)
  }
})

const verifyEmailSchema = z.object({
  token: z.string().length(64, 'Invalid token'),
})

/**
 * POST /api/auth/email/verify
 * Verify email with token.
 */
router.post('/email/verify', async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body)

    const result = await emailVerificationService.verifyEmail(token)

    res.json({
      verified: true,
      message: 'Email verified successfully',
      email: result.email,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/email
 * Remove current user's email address.
 * Requires authentication.
 */
router.delete('/email', authenticate, async (req, res, next) => {
  try {
    await userRepository.setEmail(req.userId!, null)
    const user = await userRepository.findById(req.userId!)
    res.json({ user })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/auth/email/status
 * Check if email verification service is available.
 */
router.get('/email/status', async (_req, res) => {
  res.json({
    available: emailVerificationService.isEmailConfigured(),
  })
})

// --- Sessions Management ---

/**
 * GET /api/auth/sessions
 * List active sessions for current user.
 * Identifies current session by matching the refresh token cookie hash.
 */
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await tokenService.listUserSessions(req.userId!)

    // Identify current session via refresh token cookie
    const currentRefreshToken = req.cookies?.refresh_token
    let currentTokenHash: string | null = null
    if (currentRefreshToken) {
      currentTokenHash = tokenService.hashToken(currentRefreshToken)
    }

    // Find the current session's ID by matching the token hash
    let currentSessionId: string | null = null
    if (currentTokenHash) {
      const { refreshTokenRepository } = await import('../repositories/index.js')
      const currentToken = await refreshTokenRepository.findByTokenHash(currentTokenHash)
      if (currentToken) {
        currentSessionId = currentToken.id
      }
    }

    const result = sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }))

    res.json({ sessions: result })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/sessions/:id
 * Revoke a specific session.
 */
router.delete('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const sessionId = req.params.id
    const revoked = await tokenService.revokeSession(sessionId, req.userId!)

    if (!revoked) {
      res.status(404).json({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or already revoked' },
      })
      return
    }

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/sessions
 * Revoke all other sessions (keep current).
 */
router.delete('/sessions', authenticate, async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refresh_token
    if (!currentRefreshToken) {
      // No cookie = can't identify current session, revoke all
      await tokenService.revokeAllUserTokens(req.userId!)
      res.json({ success: true, revoked: 0 })
      return
    }

    const revoked = await tokenService.revokeOtherUserTokens(req.userId!, currentRefreshToken)
    res.json({ success: true, revoked })
  } catch (error) {
    next(error)
  }
})

export default router
