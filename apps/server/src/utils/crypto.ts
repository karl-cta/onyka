import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PREFIX = 'enc:v1:'

// Binary magic header for encrypted files (4 bytes)
const FILE_MAGIC = Buffer.from('ENC1')

let encryptionKey: Buffer | null = null

/**
 * Initialize encryption with a hex-encoded 32-byte key.
 * Call once at startup. If no key is provided, encryption is disabled (pass-through).
 */
export function initEncryption(hexKey?: string): void {
  if (!hexKey) {
    encryptionKey = null
    return
  }

  if (hexKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(hexKey)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  }

  encryptionKey = Buffer.from(hexKey, 'hex')
}

/**
 * Returns true if an encryption key is configured.
 */
export function isEncryptionEnabled(): boolean {
  return encryptionKey !== null
}

/**
 * Encrypt a plaintext string. Returns the ciphertext with `enc:v1:` prefix.
 * If no key is configured, returns the plaintext unchanged (pass-through).
 */
export function encrypt(plaintext: string): string {
  if (!encryptionKey) return plaintext

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: enc:v1:<base64(iv + authTag + ciphertext)>
  const payload = Buffer.concat([iv, authTag, encrypted])
  return PREFIX + payload.toString('base64')
}

/**
 * Decrypt a value. If the value has the `enc:v1:` prefix, decrypts it.
 * If no prefix, returns as-is (plaintext pass-through for backwards compatibility).
 * Throws if the value is encrypted but no key is configured, or if integrity check fails.
 */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value

  if (!encryptionKey) {
    throw new Error('Cannot decrypt: ENCRYPTION_KEY is not configured but encrypted data was found')
  }

  const payload = Buffer.from(value.slice(PREFIX.length), 'base64')

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted payload: too short')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Encrypt a Buffer (for files). Returns: ENC1 + IV(12) + authTag(16) + ciphertext.
 * If no key is configured, returns the buffer unchanged.
 */
export function encryptBuffer(plainBuffer: Buffer): Buffer {
  if (!encryptionKey) return plainBuffer

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([FILE_MAGIC, iv, authTag, encrypted])
}

/**
 * Decrypt a Buffer (for files). Detects ENC1 header.
 * If no header, returns as-is (backward compat with unencrypted files).
 * Throws if encrypted but no key is configured, or integrity check fails.
 */
export function decryptBuffer(data: Buffer): Buffer {
  // Not encrypted — return as-is
  if (data.length < FILE_MAGIC.length || !data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    return data
  }

  if (!encryptionKey) {
    throw new Error('Cannot decrypt file: ENCRYPTION_KEY is not configured but encrypted data was found')
  }

  const headerSize = FILE_MAGIC.length + IV_LENGTH + AUTH_TAG_LENGTH
  if (data.length < headerSize) {
    throw new Error('Invalid encrypted file: too short')
  }

  const iv = data.subarray(FILE_MAGIC.length, FILE_MAGIC.length + IV_LENGTH)
  const authTag = data.subarray(FILE_MAGIC.length + IV_LENGTH, headerSize)
  const ciphertext = data.subarray(headerSize)

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
