import { userRepository, loginAttemptRepository } from '../repositories/index.js'
import { passwordService } from './password.service.js'
import { tokenService, type TokenPair, type SessionMetadata } from './token.service.js'
import { emailVerificationService } from './email-verification.service.js'
import { logger } from '../utils/index.js'
import type { User, UserCreateInput, UserLoginInput } from '@onyka/shared'
import {
  MAX_LOGIN_ATTEMPTS_USERNAME,
  MAX_LOGIN_ATTEMPTS_IP,
  LOCKOUT_DURATION_MS,
} from '@onyka/shared'

export interface AuthResult {
  user: User | null
  tokens: TokenPair | null
  requires2FA?: boolean
  userId?: string // Only sent when 2FA is required
}

interface RateLimitInfo {
  retryAfter: number
  remainingAttempts?: number
  maxAttempts?: number
}

export class AuthError extends Error {
  public rateLimitInfo?: RateLimitInfo

  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
    rateLimitInfo?: RateLimitInfo
  ) {
    super(message)
    this.name = 'AuthError'
    this.rateLimitInfo = rateLimitInfo
  }
}

export class AuthService {
  async register(input: UserCreateInput, metadata?: SessionMetadata): Promise<AuthResult> {
    if (!this.isValidUsername(input.username)) {
      throw new AuthError('Username must be 3-30 characters, alphanumeric or underscore', 'INVALID_USERNAME', 400)
    }

    const passwordValidation = passwordService.validateStrength(input.password)
    if (!passwordValidation.valid) {
      throw new AuthError(passwordValidation.message!, 'WEAK_PASSWORD', 400)
    }

    const existingUser = await userRepository.findByUsername(input.username)
    if (existingUser) {
      throw new AuthError('Username already taken', 'USERNAME_EXISTS', 409)
    }

    if (input.email) {
      const existingEmail = await userRepository.findByEmail(input.email)
      if (existingEmail) {
        throw new AuthError('Email already in use', 'EMAIL_EXISTS', 409)
      }
    }

    const passwordHash = await passwordService.hash(input.password)

    const hasAdmin = await userRepository.hasAnyAdmin()
    const role = hasAdmin ? 'user' : 'admin'

    const user = await userRepository.create({
      username: input.username,
      name: input.name || input.username,
      email: input.email,
      passwordHash,
      role,
    })

    await userRepository.setLastLoginAt(user.id)
    const tokens = await tokenService.generateTokenPair(user.id, user.username, false, metadata)

    if (input.email) {
      emailVerificationService.sendVerification(user.id, input.email).catch((err) => {
        logger.error('Failed to send verification email after registration', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }

    return { user, tokens }
  }

  async login(input: UserLoginInput, ipAddress: string, rememberMe = false, metadata?: SessionMetadata): Promise<AuthResult> {
    const { remainingAttempts } = await this.checkRateLimits(input.username, ipAddress)

    const userWithPassword = await userRepository.findByUsernameWithPassword(input.username)

    if (!userWithPassword) {
      await passwordService.hash('dummy_password_for_timing')
      await this.recordFailedAttempt(input.username, ipAddress)
      const newRemaining = remainingAttempts - 1
      throw new AuthError(
        'Invalid username or password',
        'INVALID_CREDENTIALS',
        401,
        newRemaining > 0
          ? { retryAfter: 0, remainingAttempts: newRemaining, maxAttempts: MAX_LOGIN_ATTEMPTS_USERNAME }
          : undefined
      )
    }

    if (userWithPassword.isDisabled) {
      throw new AuthError(
        'Your account has been disabled. Please contact an administrator.',
        'ACCOUNT_DISABLED',
        403
      )
    }

    const isValid = await passwordService.verify(userWithPassword.passwordHash, input.password)
    if (!isValid) {
      await this.recordFailedAttempt(input.username, ipAddress)
      const newRemaining = remainingAttempts - 1
      throw new AuthError(
        'Invalid username or password',
        'INVALID_CREDENTIALS',
        401,
        newRemaining > 0
          ? { retryAfter: 0, remainingAttempts: newRemaining, maxAttempts: MAX_LOGIN_ATTEMPTS_USERNAME }
          : undefined
      )
    }

    // Rehash if algorithm updated (fire and forget)
    const needsRehash = await passwordService.needsRehash(userWithPassword.passwordHash)
    if (needsRehash) {
      const newHash = await passwordService.hash(input.password)
      userRepository.updatePasswordHash(userWithPassword.id, newHash).catch((err) => {
        logger.error('Failed to rehash password during login', {
          userId: userWithPassword.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }

    await loginAttemptRepository.create(input.username, ipAddress, true)

    if (userWithPassword.twoFactorEnabled) {
      return {
        user: null,
        tokens: null,
        requires2FA: true,
        userId: userWithPassword.id,
      }
    }

    await userRepository.setLastLoginAt(userWithPassword.id)

    const tokens = await tokenService.generateTokenPair(userWithPassword.id, userWithPassword.username, rememberMe, metadata)

    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      name: userWithPassword.name,
      email: userWithPassword.email ?? undefined,
      emailVerified: userWithPassword.emailVerified,
      avatarUrl: userWithPassword.avatarUrl ?? undefined,
      avatarColor: userWithPassword.avatarColor,
      role: userWithPassword.role,
      isDisabled: userWithPassword.isDisabled,
      twoFactorEnabled: userWithPassword.twoFactorEnabled,
      trackingEnabled: userWithPassword.trackingEnabled,
      language: userWithPassword.language,
      theme: userWithPassword.theme,
      darkThemeBase: userWithPassword.darkThemeBase,
      lightThemeBase: userWithPassword.lightThemeBase,
      accentColor: userWithPassword.accentColor,
      editorFontSize: userWithPassword.editorFontSize,
      editorFontFamily: userWithPassword.editorFontFamily,
      sidebarCollapsed: userWithPassword.sidebarCollapsed,
      sidebarWidth: userWithPassword.sidebarWidth,
      tagsCollapsed: userWithPassword.tagsCollapsed,
      tagsSectionHeight: userWithPassword.tagsSectionHeight,
      sharedCollapsed: userWithPassword.sharedCollapsed,
      sharedSectionHeight: userWithPassword.sharedSectionHeight,
      onboardingCompleted: userWithPassword.onboardingCompleted,
      lastLoginAt: userWithPassword.lastLoginAt ?? undefined,
      createdAt: userWithPassword.createdAt,
      updatedAt: userWithPassword.updatedAt,
    }

    return { user, tokens }
  }

  /**
   * Complete login after successful 2FA verification
   */
  async completeLoginAfter2FA(userId: string, rememberMe = false, metadata?: SessionMetadata): Promise<AuthResult> {
    const userWithPassword = await userRepository.findByIdWithPassword(userId)
    if (!userWithPassword) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (userWithPassword.isDisabled) {
      throw new AuthError('Your account has been disabled', 'ACCOUNT_DISABLED', 403)
    }

    await userRepository.setLastLoginAt(userId)

    const tokens = await tokenService.generateTokenPair(userWithPassword.id, userWithPassword.username, rememberMe, metadata)

    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      name: userWithPassword.name,
      email: userWithPassword.email ?? undefined,
      emailVerified: userWithPassword.emailVerified,
      avatarUrl: userWithPassword.avatarUrl ?? undefined,
      avatarColor: userWithPassword.avatarColor,
      role: userWithPassword.role,
      isDisabled: userWithPassword.isDisabled,
      twoFactorEnabled: userWithPassword.twoFactorEnabled,
      trackingEnabled: userWithPassword.trackingEnabled,
      language: userWithPassword.language,
      theme: userWithPassword.theme,
      darkThemeBase: userWithPassword.darkThemeBase,
      lightThemeBase: userWithPassword.lightThemeBase,
      accentColor: userWithPassword.accentColor,
      editorFontSize: userWithPassword.editorFontSize,
      editorFontFamily: userWithPassword.editorFontFamily,
      sidebarCollapsed: userWithPassword.sidebarCollapsed,
      sidebarWidth: userWithPassword.sidebarWidth,
      tagsCollapsed: userWithPassword.tagsCollapsed,
      tagsSectionHeight: userWithPassword.tagsSectionHeight,
      sharedCollapsed: userWithPassword.sharedCollapsed,
      sharedSectionHeight: userWithPassword.sharedSectionHeight,
      onboardingCompleted: userWithPassword.onboardingCompleted,
      lastLoginAt: userWithPassword.lastLoginAt ?? undefined,
      createdAt: userWithPassword.createdAt,
      updatedAt: userWithPassword.updatedAt,
    }

    return { user, tokens }
  }

  async logout(refreshToken: string): Promise<void> {
    await tokenService.revokeRefreshToken(refreshToken)
  }

  async logoutAll(userId: string): Promise<void> {
    await tokenService.revokeAllUserTokens(userId)
  }

  async refreshTokens(refreshToken: string, metadata?: SessionMetadata): Promise<TokenPair> {
    const payload = await tokenService.verifyRefreshToken(refreshToken)
    if (!payload) {
      throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN')
    }

    const user = await userRepository.findById(payload.sub)
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND')
    }

    const newRefreshToken = await tokenService.rotateRefreshToken(refreshToken, user.id, metadata)
    if (!newRefreshToken) {
      throw new AuthError('Session invalidated for security. Please login again.', 'TOKEN_THEFT_DETECTED')
    }

    const accessToken = await tokenService.generateAccessToken(user.id, user.username)

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    }
  }

  async getCurrentUser(accessToken: string): Promise<User | null> {
    const payload = await tokenService.verifyAccessToken(accessToken)
    if (!payload) {
      return null
    }

    return userRepository.findById(payload.sub)
  }

  async updateProfile(
    userId: string,
    input: { currentPassword?: string; newPassword?: string }
  ): Promise<User> {
    const user = await userRepository.findById(userId)
    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (input.newPassword) {
      if (!input.currentPassword) {
        throw new AuthError('Current password is required', 'MISSING_CURRENT_PASSWORD', 400)
      }

      const userWithPassword = await userRepository.findByUsernameWithPassword(user.username)
      if (!userWithPassword) {
        throw new AuthError('User not found', 'USER_NOT_FOUND', 404)
      }

      const isValid = await passwordService.verify(userWithPassword.passwordHash, input.currentPassword)
      if (!isValid) {
        throw new AuthError('Current password is incorrect', 'INVALID_PASSWORD', 400)
      }

      const passwordValidation = passwordService.validateStrength(input.newPassword)
      if (!passwordValidation.valid) {
        throw new AuthError(passwordValidation.message!, 'WEAK_PASSWORD', 400)
      }

      const newHash = await passwordService.hash(input.newPassword)
      await userRepository.updatePasswordHash(userId, newHash)
    }

    return user
  }

  private async checkRateLimits(username: string, ipAddress: string): Promise<{ remainingAttempts: number }> {
    const since = new Date(Date.now() - LOCKOUT_DURATION_MS)

    const [usernameAttempts, ipAttempts] = await Promise.all([
      loginAttemptRepository.countFailedByUsername(username, since),
      loginAttemptRepository.countFailedByIp(ipAddress, since),
    ])

    if (usernameAttempts >= MAX_LOGIN_ATTEMPTS_USERNAME) {
      // Get the first failed attempt to calculate when lockout expires
      const firstFailedAttempt = await loginAttemptRepository.getFirstFailedSince(username, since)
      const lockoutExpiresAt = firstFailedAttempt
        ? new Date(firstFailedAttempt.attemptedAt.getTime() + LOCKOUT_DURATION_MS)
        : new Date(Date.now() + LOCKOUT_DURATION_MS)
      const retryAfter = Math.ceil((lockoutExpiresAt.getTime() - Date.now()) / 1000)

      throw new AuthError(
        'Account temporarily locked. Please try again later.',
        'ACCOUNT_LOCKED',
        429,
        {
          retryAfter: Math.max(0, retryAfter),
          remainingAttempts: 0,
          maxAttempts: MAX_LOGIN_ATTEMPTS_USERNAME,
        }
      )
    }

    if (ipAttempts >= MAX_LOGIN_ATTEMPTS_IP) {
      // Get the first failed attempt to calculate when lockout expires
      const firstFailedAttempt = await loginAttemptRepository.getFirstFailedByIpSince(ipAddress, since)
      const lockoutExpiresAt = firstFailedAttempt
        ? new Date(firstFailedAttempt.attemptedAt.getTime() + LOCKOUT_DURATION_MS)
        : new Date(Date.now() + LOCKOUT_DURATION_MS)
      const retryAfter = Math.ceil((lockoutExpiresAt.getTime() - Date.now()) / 1000)

      throw new AuthError(
        'Too many failed attempts. Please try again later.',
        'IP_BLOCKED',
        429,
        {
          retryAfter: Math.max(0, retryAfter),
          remainingAttempts: 0,
          maxAttempts: MAX_LOGIN_ATTEMPTS_IP,
        }
      )
    }

    return { remainingAttempts: MAX_LOGIN_ATTEMPTS_USERNAME - usernameAttempts }
  }

  private async recordFailedAttempt(username: string, ipAddress: string): Promise<void> {
    await loginAttemptRepository.create(username, ipAddress, false)
  }

  private isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
    return usernameRegex.test(username)
  }
}

export const authService = new AuthService()
