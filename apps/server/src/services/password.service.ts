import argon2 from 'argon2'

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 4,
  parallelism: 4,
  hashLength: 32,
}

export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS)
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password)
    } catch {
      return false
    }
  }

  async needsRehash(hash: string): Promise<boolean> {
    return argon2.needsRehash(hash, ARGON2_OPTIONS)
  }

  validateStrength(password: string): { valid: boolean; message?: string } {
    if (password.length < 12) {
      return { valid: false, message: 'Password must be at least 12 characters long' }
    }
    if (password.length > 128) {
      return { valid: false, message: 'Password must be at most 128 characters long' }
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' }
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' }
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one digit' }
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'`~]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character' }
    }
    return { valid: true }
  }
}

export const passwordService = new PasswordService()
