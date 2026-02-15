import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import * as schema from '../../db/schema.js'

let sqlite: Database.Database
let testDb: ReturnType<typeof drizzle<typeof schema>>
let ownerUserId: string
let sharedUserId: string

beforeAll(() => {
  sqlite = new Database(':memory:')
  testDb = drizzle(sqlite, { schema })

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT false NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE notes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '' NOT NULL,
      mode TEXT DEFAULT 'text' NOT NULL,
      folder_id TEXT,
      owner_id TEXT NOT NULL,
      is_deleted INTEGER DEFAULT false NOT NULL,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE folders (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      owner_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE shares (
      id TEXT PRIMARY KEY NOT NULL,
      resource_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      shared_with_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // Create test users
  ownerUserId = nanoid()
  sharedUserId = nanoid()
  const now = new Date()

  testDb.insert(schema.users).values([
    { id: ownerUserId, username: 'owner', passwordHash: 'hash', name: 'Owner', createdAt: now, updatedAt: now },
    { id: sharedUserId, username: 'shareduser', passwordHash: 'hash', name: 'Shared User', createdAt: now, updatedAt: now },
  ]).run()
})

afterAll(() => {
  sqlite.close()
})

describe('Sharing Integration', () => {
  describe('Note Sharing', () => {
    it('should share a note with another user', async () => {
      const noteId = nanoid()
      const shareId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Shared Note',
        content: 'Secret content',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: shareId,
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'read',
        createdAt: now,
      })

      const result = await testDb.select().from(schema.shares).where(eq(schema.shares.id, shareId))
      expect(result).toHaveLength(1)
      expect(result[0].permission).toBe('read')
    })

    it('should update share permission', async () => {
      const noteId = nanoid()
      const shareId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Note to Update Share',
        content: '',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: shareId,
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'read',
        createdAt: now,
      })

      await testDb.update(schema.shares)
        .set({ permission: 'edit' })
        .where(eq(schema.shares.id, shareId))

      const result = await testDb.select().from(schema.shares).where(eq(schema.shares.id, shareId))
      expect(result[0].permission).toBe('edit')
    })

    it('should revoke share', async () => {
      const noteId = nanoid()
      const shareId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Note to Unshare',
        content: '',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: shareId,
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'read',
        createdAt: now,
      })

      await testDb.delete(schema.shares).where(eq(schema.shares.id, shareId))

      const result = await testDb.select().from(schema.shares).where(eq(schema.shares.id, shareId))
      expect(result).toHaveLength(0)
    })

    it('should list shares for a user', async () => {
      const note1Id = nanoid()
      const note2Id = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values([
        { id: note1Id, title: 'Shared 1', content: '', mode: 'text', ownerId: ownerUserId, isDeleted: false, createdAt: now, updatedAt: now },
        { id: note2Id, title: 'Shared 2', content: '', mode: 'text', ownerId: ownerUserId, isDeleted: false, createdAt: now, updatedAt: now },
      ])

      await testDb.insert(schema.shares).values([
        { id: nanoid(), resourceId: note1Id, resourceType: 'note', ownerId: ownerUserId, sharedWithId: sharedUserId, permission: 'read', createdAt: now },
        { id: nanoid(), resourceId: note2Id, resourceType: 'note', ownerId: ownerUserId, sharedWithId: sharedUserId, permission: 'edit', createdAt: now },
      ])

      const result = await testDb.select()
        .from(schema.shares)
        .where(eq(schema.shares.sharedWithId, sharedUserId))

      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Folder Sharing', () => {
    it('should share a folder with another user', async () => {
      const folderId = nanoid()
      const shareId = nanoid()
      const now = new Date()

      await testDb.insert(schema.folders).values({
        id: folderId,
        name: 'Shared Folder',
        ownerId: ownerUserId,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: shareId,
        resourceId: folderId,
        resourceType: 'folder',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'read',
        createdAt: now,
      })

      const result = await testDb.select().from(schema.shares).where(eq(schema.shares.id, shareId))
      expect(result).toHaveLength(1)
      expect(result[0].resourceType).toBe('folder')
    })
  })

  describe('Permission Levels', () => {
    it('should support read permission', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Read Only',
        content: '',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: nanoid(),
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'read',
        createdAt: now,
      })

      const shares = await testDb.select()
        .from(schema.shares)
        .where(and(
          eq(schema.shares.resourceId, noteId),
          eq(schema.shares.sharedWithId, sharedUserId)
        ))

      expect(shares[0].permission).toBe('read')
    })

    it('should support edit permission', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Editable',
        content: '',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: nanoid(),
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'edit',
        createdAt: now,
      })

      const shares = await testDb.select()
        .from(schema.shares)
        .where(and(
          eq(schema.shares.resourceId, noteId),
          eq(schema.shares.sharedWithId, sharedUserId)
        ))

      expect(shares[0].permission).toBe('edit')
    })

    it('should support admin permission', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Admin Access',
        content: '',
        mode: 'text',
        ownerId: ownerUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.shares).values({
        id: nanoid(),
        resourceId: noteId,
        resourceType: 'note',
        ownerId: ownerUserId,
        sharedWithId: sharedUserId,
        permission: 'admin',
        createdAt: now,
      })

      const shares = await testDb.select()
        .from(schema.shares)
        .where(and(
          eq(schema.shares.resourceId, noteId),
          eq(schema.shares.sharedWithId, sharedUserId)
        ))

      expect(shares[0].permission).toBe('admin')
    })
  })
})
