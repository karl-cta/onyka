import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { createHash, randomBytes } from 'crypto'
import { env } from '../config/env.js'
import {
  refreshTokenRepository,
  revokedAccessTokenRepository,
  type SessionInfo,
} from '../repositories/index.js'

export interface AccessTokenPayload extends JWTPayload {
  sub: string
  username: string
  type: 'access'
  jti: string
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string
  type: 'refresh'
  jti: string
}

export interface PendingAuthTokenPayload extends JWTPayload {
  sub: string
  type: 'pending-2fa'
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SessionMetadata {
  userAgent?: string
  ipAddress?: string
}

// Refresh token duration: short (1 day) without rememberMe, long (from env) with rememberMe
const REFRESH_TOKEN_SHORT_DAYS = 1

export class TokenService {
  private readonly secret: Uint8Array
  private readonly accessExpiresIn: string
  private readonly refreshExpiresInDaysLong: number

  constructor() {
    this.secret = new TextEncoder().encode(env.JWT_SECRET)
    this.accessExpiresIn = env.JWT_ACCESS_EXPIRY
    this.refreshExpiresInDaysLong = env.JWT_REFRESH_EXPIRY_DAYS
  }

  async generateTokenPair(
    userId: string,
    username: string,
    rememberMe = false,
    metadata?: SessionMetadata
  ): Promise<TokenPair> {
    const refreshExpiryDays = rememberMe ? this.refreshExpiresInDaysLong : REFRESH_TOKEN_SHORT_DAYS

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, username),
      this.generateRefreshToken(userId, refreshExpiryDays, metadata),
    ])

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(this.accessExpiresIn),
    }
  }

  async generateAccessToken(userId: string, username: string): Promise<string> {
    const jti = randomBytes(16).toString('hex')
    const payload: AccessTokenPayload = { sub: userId, username, type: 'access', jti }

    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.accessExpiresIn)
      .setIssuer('onyka')
      .setAudience('onyka')
      .sign(this.secret)
  }

  async generateRefreshToken(
    userId: string,
    expiryDays?: number,
    metadata?: SessionMetadata
  ): Promise<string> {
    const jti = randomBytes(32).toString('hex')
    const days = expiryDays ?? this.refreshExpiresInDaysLong
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const payload: RefreshTokenPayload = { sub: userId, type: 'refresh', jti }

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .setIssuer('onyka')
      .setAudience('onyka')
      .sign(this.secret)

    const tokenHash = this.hashToken(token)
    await refreshTokenRepository.create(userId, tokenHash, expiresAt, metadata)

    return token
  }

  async generatePendingAuthToken(userId: string): Promise<string> {
    const payload: PendingAuthTokenPayload = { sub: userId, type: 'pending-2fa' }
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('onyka')
      .setAudience('onyka')
      .sign(this.secret)
  }

  async verifyPendingAuthToken(token: string): Promise<PendingAuthTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'onyka',
        audience: 'onyka',
      })
      if (payload.type !== 'pending-2fa') return null
      return payload as unknown as PendingAuthTokenPayload
    } catch {
      return null
    }
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'onyka',
        audience: 'onyka',
      })

      if (payload.type !== 'access') return null
      if (typeof payload.jti !== 'string') return null
      if (await revokedAccessTokenRepository.isRevoked(payload.jti)) return null

      return payload as unknown as AccessTokenPayload
    } catch {
      return null
    }
  }

  async revokeAccessToken(token: string): Promise<void> {
    const decoded = await this.decodeAccessToken(token)
    if (!decoded) return
    const { jti, exp } = decoded
    const expiresAt = typeof exp === 'number' ? new Date(exp * 1000) : new Date(Date.now() + 15 * 60 * 1000)
    await revokedAccessTokenRepository.add(jti, expiresAt)
  }

  private async decodeAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'onyka',
        audience: 'onyka',
      })
      if (payload.type !== 'access' || typeof payload.jti !== 'string') return null
      return payload as unknown as AccessTokenPayload
    } catch {
      return null
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'onyka',
        audience: 'onyka',
      })

      if (payload.type !== 'refresh') return null

      const tokenHash = this.hashToken(token)
      const isValid = await refreshTokenRepository.isValid(tokenHash)
      if (!isValid) return null

      return payload as unknown as RefreshTokenPayload
    } catch {
      return null
    }
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token)
    return refreshTokenRepository.deleteByTokenHash(tokenHash)
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    return refreshTokenRepository.deleteByUser(userId)
  }

  async revokeOtherUserTokens(userId: string, currentToken: string): Promise<number> {
    const tokenHash = this.hashToken(currentToken)
    return refreshTokenRepository.deleteOthersByUser(userId, tokenHash)
  }

  async rotateRefreshToken(oldToken: string, userId: string, metadata?: SessionMetadata): Promise<string | null> {
    const revoked = await this.revokeRefreshToken(oldToken)
    if (!revoked) {
      await this.revokeAllUserTokens(userId)
      return null
    }
    return this.generateRefreshToken(userId, undefined, metadata)
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    return refreshTokenRepository.listActiveSessions(userId)
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const token = await refreshTokenRepository.findById(sessionId)
    if (!token || token.userId !== userId) return false
    return refreshTokenRepository.delete(sessionId)
  }

  async cleanupExpiredTokens(): Promise<number> {
    const [refresh, access] = await Promise.all([
      refreshTokenRepository.deleteExpired(),
      revokedAccessTokenRepository.deleteExpired(),
    ])
    return refresh + access
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/)
    if (!match) return 900

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 3600
      case 'd': return value * 86400
      default: return 900
    }
  }
}

export const tokenService = new TokenService()
