export interface RecoveryCode {
  id: string
  userId: string
  used: boolean
  usedAt?: Date
  createdAt: Date
}

export interface RecoveryCodesResponse {
  codes: string[] // Plain text codes - only shown once!
  message: string
}

export interface RecoveryCodesStatus {
  total: number
  remaining: number
  createdAt?: Date
}

export interface PasswordResetRequest {
  identifier: string // username or email
}

export interface PasswordResetConfirm {
  token: string
  newPassword: string
}

export interface EmailVerificationRequest {
  email: string
}

export interface EmailVerificationConfirm {
  token: string
}
