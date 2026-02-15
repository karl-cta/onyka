import { existsSync, mkdirSync, unlinkSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { nanoid } from 'nanoid'
import { eq, sql } from 'drizzle-orm'
import { fileTypeFromBuffer } from 'file-type'
import { db } from '../db/index.js'
import { uploads } from '../db/schema.js'
import { encryptBuffer, decryptBuffer } from '../utils/crypto.js'

// Upload configuration
const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')
const MAX_IMAGE_SIZE_MB = 5
const MAX_STORAGE_PER_USER_MB = 100
const MAX_STORAGE_PER_USER_BYTES = MAX_STORAGE_PER_USER_MB * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o755 })
}

export interface UploadResult {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

export interface UploadError {
  code: 'INVALID_TYPE' | 'INVALID_CONTENT' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED'
  message: string
}

// Map of allowed MIME types to their file-type identifiers
const ALLOWED_MIME_SET = new Set(ALLOWED_IMAGE_TYPES)

/**
 * Validate that the file is an allowed image type
 */
export function validateImageFile(
  file: Express.Multer.File
): UploadError | null {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return {
      code: 'INVALID_TYPE',
      message: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    }
  }

  // Check extension
  const ext = extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      code: 'INVALID_TYPE',
      message: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  // Check file size
  const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB`,
    }
  }

  return null
}

/**
 * Validate file content by reading magic bytes
 * Must be called after multer has saved the file to disk
 */
export async function validateFileContent(
  file: Express.Multer.File
): Promise<UploadError | null> {
  try {
    const filePath = join(UPLOADS_DIR, file.filename)
    const buffer = readFileSync(filePath)
    const fileTypeResult = await fileTypeFromBuffer(buffer)

    if (!fileTypeResult) {
      return {
        code: 'INVALID_CONTENT',
        message: 'Unable to determine file type from content. The file may be corrupted.',
      }
    }

    if (!ALLOWED_MIME_SET.has(fileTypeResult.mime)) {
      return {
        code: 'INVALID_CONTENT',
        message: `File content does not match an allowed image type. Detected: ${fileTypeResult.mime}`,
      }
    }

    // Verify declared MIME matches actual content
    if (file.mimetype !== fileTypeResult.mime) {
      return {
        code: 'INVALID_CONTENT',
        message: `File content (${fileTypeResult.mime}) does not match declared type (${file.mimetype}).`,
      }
    }

    return null
  } catch {
    return {
      code: 'UPLOAD_FAILED',
      message: 'Failed to validate file content.',
    }
  }
}

/**
 * Process an uploaded file and return its metadata
 * File is already saved to disk by multer, we just need to return the info
 */
export function processUploadedFile(
  file: Express.Multer.File
): UploadResult {
  // Use the filename that multer already saved (don't generate a new one!)
  const filename = file.filename
  // Extract ID from filename (filename is "{nanoid}.{ext}")
  const id = filename.replace(extname(filename), '')

  return {
    id,
    filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/api/uploads/${filename}`,
  }
}

/**
 * Get the full path to an uploaded file
 */
export function getUploadPath(filename: string): string | null {
  // Sanitize filename to prevent directory traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  if (sanitized !== filename) {
    return null
  }

  const filePath = join(UPLOADS_DIR, sanitized)

  // Verify file exists and is within uploads directory
  if (!existsSync(filePath)) {
    return null
  }

  // Verify it's a file, not a directory
  const stats = statSync(filePath)
  if (!stats.isFile()) {
    return null
  }

  return filePath
}

/**
 * Delete an uploaded file
 */
export function deleteUploadedFile(filename: string): boolean {
  const filePath = getUploadPath(filename)
  if (!filePath) {
    return false
  }

  try {
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get uploads directory path
 */
export function getUploadsDir(): string {
  return UPLOADS_DIR
}

/**
 * Get max image size in bytes
 */
export function getMaxImageSizeBytes(): number {
  return MAX_IMAGE_SIZE_MB * 1024 * 1024
}

/**
 * Track an upload in the database for ownership
 */
export async function trackUpload(file: Express.Multer.File, ownerId: string): Promise<void> {
  await db.insert(uploads).values({
    id: nanoid(),
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    ownerId,
    createdAt: new Date(),
  })
}

/**
 * Get the owner of an uploaded file
 */
export async function getUploadOwner(filename: string): Promise<string | null> {
  const result = await db.query.uploads.findFirst({
    where: eq(uploads.filename, filename),
    columns: { ownerId: true },
  })
  return result?.ownerId ?? null
}

/**
 * Delete an upload from both disk and database
 */
export async function deleteTrackedUpload(filename: string): Promise<boolean> {
  const deleted = deleteUploadedFile(filename)
  if (deleted) {
    await db.delete(uploads).where(eq(uploads.filename, filename))
  }
  return deleted
}

/**
 * Get total storage used by a user in bytes
 */
export async function getUserStorageUsed(ownerId: string): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${uploads.size}), 0)` })
    .from(uploads)
    .where(eq(uploads.ownerId, ownerId))
  return result[0]?.total ?? 0
}

/**
 * Check if a user has enough quota for a new upload
 * Returns null if OK, or an error object if quota exceeded
 */
export async function checkUserQuota(
  ownerId: string,
  newFileSize: number
): Promise<UploadError | null> {
  const used = await getUserStorageUsed(ownerId)
  if (used + newFileSize > MAX_STORAGE_PER_USER_BYTES) {
    const usedMB = (used / (1024 * 1024)).toFixed(1)
    return {
      code: 'FILE_TOO_LARGE',
      message: `Storage quota exceeded. You are using ${usedMB} MB of ${MAX_STORAGE_PER_USER_MB} MB.`,
    }
  }
  return null
}

/**
 * Encrypt the file on disk (in-place). Call after validation passes.
 * Reads the plaintext file, encrypts it with AES-256-GCM, overwrites the file.
 */
export function encryptUploadedFile(filename: string): void {
  const filePath = join(UPLOADS_DIR, filename)
  const plainBuffer = readFileSync(filePath)
  const encrypted = encryptBuffer(plainBuffer)
  writeFileSync(filePath, encrypted)
}

/**
 * Read and decrypt a file from disk. Returns the plaintext buffer.
 * Handles both encrypted (ENC1 header) and unencrypted files (backward compat).
 */
export function readDecryptedFile(filePath: string): Buffer {
  const data = readFileSync(filePath)
  return decryptBuffer(data)
}

export const uploadsService = {
  validateImageFile,
  validateFileContent,
  processUploadedFile,
  getUploadPath,
  deleteUploadedFile,
  deleteTrackedUpload,
  trackUpload,
  getUploadOwner,
  getUploadsDir,
  getMaxImageSizeBytes,
  getUserStorageUsed,
  checkUserQuota,
  encryptUploadedFile,
  readDecryptedFile,
  ALLOWED_IMAGE_TYPES,
  MAX_STORAGE_PER_USER_MB,
}
