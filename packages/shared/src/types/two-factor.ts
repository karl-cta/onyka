export interface TwoFactorSetupResponse {
  qrCode: string // Data URL for QR code image
  manualKey: string // Manual entry key (formatted with spaces)
}

export interface TwoFactorVerifyInput {
  code: string
  isRecoveryCode?: boolean
}

export interface TwoFactorStatus {
  enabled: boolean
  hasEmail: boolean // Required for 2FA setup
  recoveryCodesRemaining?: number
}

export interface TwoFactorLoginResponse {
  user?: {
    id: string
    username: string
    name: string
    email?: string
    emailVerified: boolean
    avatarUrl?: string
    role: 'user' | 'admin'
    isDisabled: boolean
    twoFactorEnabled: boolean
    trackingEnabled: boolean
    language: 'en' | 'fr'
    createdAt: Date
    updatedAt: Date
  }
  tokens?: {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }
  requires2FA?: boolean
  userId?: string // Only sent when 2FA is required
}
