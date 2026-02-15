import crypto from 'crypto'
import { recoveryCodeRepository } from '../repositories/index.js'

const CODE_COUNT = 10 // Number of recovery codes to generate

export class RecoveryCodeService {
  /**
   * Generate new recovery codes for a user.
   * Returns plain text codes - these should only be shown once!
   */
  async generateForUser(userId: string): Promise<string[]> {
    // Delete existing codes
    await recoveryCodeRepository.deleteAllForUser(userId)

    // Generate new codes
    const codes = this.generateCodes()
    const codeHashes = codes.map((code) => this.hashCode(code))

    // Store hashes
    await recoveryCodeRepository.createMany(userId, codeHashes)

    // Return plain text codes
    return codes
  }

  /**
   * Verify and consume a recovery code.
   * Returns true if valid, false otherwise.
   */
  async useCode(userId: string, code: string): Promise<boolean> {
    // Normalize code (uppercase, remove dashes/spaces)
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const codeHash = this.hashCode(normalizedCode)

    // Find unused code
    const recoveryCode = await recoveryCodeRepository.findUnusedByHash(userId, codeHash)
    if (!recoveryCode) {
      return false
    }

    // Mark as used
    await recoveryCodeRepository.markAsUsed(recoveryCode.id)

    return true
  }

  /**
   * Get recovery codes status for a user
   */
  async getStatus(userId: string): Promise<{
    total: number
    remaining: number
    createdAt: Date | null
  }> {
    const remaining = await recoveryCodeRepository.countRemaining(userId)
    const createdAt = await recoveryCodeRepository.getCreatedAt(userId)

    return {
      total: CODE_COUNT,
      remaining,
      createdAt,
    }
  }

  /**
   * Check if user has any recovery codes
   */
  async hasRecoveryCodes(userId: string): Promise<boolean> {
    const remaining = await recoveryCodeRepository.countRemaining(userId)
    return remaining > 0
  }

  private generateCodes(): string[] {
    return Array.from({ length: CODE_COUNT }, () => {
      // Format: XXXX-XXXX (8 characters, easy to read)
      const bytes = crypto.randomBytes(4)
      const hex = bytes.toString('hex').toUpperCase()
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
    })
  }

  private hashCode(code: string): string {
    // Normalize before hashing (uppercase, no dashes)
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }
}

export const recoveryCodeService = new RecoveryCodeService()
