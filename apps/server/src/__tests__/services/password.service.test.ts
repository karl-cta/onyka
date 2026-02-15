import { describe, it, expect } from 'vitest'
import { passwordService } from '../../services/password.service.js'

describe('PasswordService', () => {
  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123'
      const hash = await passwordService.hash(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.startsWith('$argon2id$')).toBe(true)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123'
      const hash1 = await passwordService.hash(password)
      const hash2 = await passwordService.hash(password)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123'
      const hash = await passwordService.hash(password)

      const isValid = await passwordService.verify(hash, password)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123'
      const hash = await passwordService.hash(password)

      const isValid = await passwordService.verify(hash, 'WrongPassword123')
      expect(isValid).toBe(false)
    })

    it('should handle invalid hash gracefully', async () => {
      const isValid = await passwordService.verify('invalid_hash', 'password')
      expect(isValid).toBe(false)
    })
  })

  describe('validateStrength', () => {
    it('should accept valid password', () => {
      const result = passwordService.validateStrength('ValidPass123!')
      expect(result.valid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    it('should reject password shorter than 12 characters', () => {
      const result = passwordService.validateStrength('Short1A!')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('at least 12 characters')
    })

    it('should reject password longer than 128 characters', () => {
      const longPassword = 'A'.repeat(100) + 'a1' + 'B'.repeat(30)
      const result = passwordService.validateStrength(longPassword)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('at most 128 characters')
    })

    it('should reject password without lowercase letter', () => {
      const result = passwordService.validateStrength('UPPERCASE123')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('lowercase letter')
    })

    it('should reject password without uppercase letter', () => {
      const result = passwordService.validateStrength('lowercase123')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('uppercase letter')
    })

    it('should reject password without digit', () => {
      const result = passwordService.validateStrength('NoDigitsHere!')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('digit')
    })

    it('should reject password without special character', () => {
      const result = passwordService.validateStrength('NoSpecial123')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('special character')
    })

    it('should accept password with various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '-', '+', '=']
      for (const char of specialChars) {
        const result = passwordService.validateStrength(`ValidPass1${char}`)
        expect(result.valid).toBe(true)
      }
    })
  })
})
