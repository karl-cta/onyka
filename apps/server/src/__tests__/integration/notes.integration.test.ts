import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.js'

// Create in-memory test database
let sqlite: Database.Database
let testDb: ReturnType<typeof drizzle<typeof schema>>
let testUserId: string

beforeAll(() => {
  sqlite = new Database(':memory:')
  testDb = drizzle(sqlite, { schema })

  // Create tables
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT false NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE folders (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      owner_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
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
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#610094' NOT NULL,
      owner_id TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE versions (
      id TEXT PRIMARY KEY NOT NULL,
      note_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
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

  // Create test user
  testUserId = nanoid()
  const now = new Date()
  testDb.insert(schema.users).values({
    id: testUserId,
    username: 'testuser',
    passwordHash: 'hashed_password',
    name: 'Test User',
    createdAt: now,
    updatedAt: now,
  }).run()
})

afterAll(() => {
  sqlite.close()
})

describe('Notes Integration', () => {
  describe('CRUD Operations', () => {
    it('should create a note', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Test Note',
        content: 'Hello world',
        mode: 'text',
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      const result = await testDb.select().from(schema.notes).where(eq(schema.notes.id, noteId))
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Test Note')
      expect(result[0].content).toBe('Hello world')
    })

    it('should update a note', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Original Title',
        content: 'Original content',
        mode: 'text',
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.update(schema.notes)
        .set({ title: 'Updated Title', content: 'Updated content' })
        .where(eq(schema.notes.id, noteId))

      const result = await testDb.select().from(schema.notes).where(eq(schema.notes.id, noteId))
      expect(result[0].title).toBe('Updated Title')
      expect(result[0].content).toBe('Updated content')
    })

    it('should soft delete a note', async () => {
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'To Delete',
        content: '',
        mode: 'text',
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.update(schema.notes)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(schema.notes.id, noteId))

      const result = await testDb.select().from(schema.notes).where(eq(schema.notes.id, noteId))
      expect(result[0].isDeleted).toBe(true)
      expect(result[0].deletedAt).not.toBeNull()
    })

    it('should list notes by owner', async () => {
      // Create a few notes
      for (let i = 0; i < 3; i++) {
        await testDb.insert(schema.notes).values({
          id: nanoid(),
          title: `Note ${i}`,
          content: '',
          mode: 'text',
          ownerId: testUserId,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      const result = await testDb.select()
        .from(schema.notes)
        .where(eq(schema.notes.ownerId, testUserId))

      expect(result.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Notes with Folders', () => {
    it('should create a note in a folder', async () => {
      const folderId = nanoid()
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.folders).values({
        id: folderId,
        name: 'Test Folder',
        ownerId: testUserId,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Note in Folder',
        content: '',
        mode: 'text',
        folderId: folderId,
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      const result = await testDb.select().from(schema.notes).where(eq(schema.notes.id, noteId))
      expect(result[0].folderId).toBe(folderId)
    })

    it('should move a note to another folder', async () => {
      const folder1Id = nanoid()
      const folder2Id = nanoid()
      const noteId = nanoid()
      const now = new Date()

      await testDb.insert(schema.folders).values([
        { id: folder1Id, name: 'Folder 1', ownerId: testUserId, createdAt: now, updatedAt: now },
        { id: folder2Id, name: 'Folder 2', ownerId: testUserId, createdAt: now, updatedAt: now },
      ])

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Movable Note',
        content: '',
        mode: 'text',
        folderId: folder1Id,
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.update(schema.notes)
        .set({ folderId: folder2Id })
        .where(eq(schema.notes.id, noteId))

      const result = await testDb.select().from(schema.notes).where(eq(schema.notes.id, noteId))
      expect(result[0].folderId).toBe(folder2Id)
    })
  })

  describe('Notes with Tags', () => {
    it('should add tags to a note', async () => {
      const noteId = nanoid()
      const tag1Id = nanoid()
      const tag2Id = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Tagged Note',
        content: '',
        mode: 'text',
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.tags).values([
        { id: tag1Id, name: 'Important', color: '#ff0000', ownerId: testUserId },
        { id: tag2Id, name: 'Work', color: '#00ff00', ownerId: testUserId },
      ])

      await testDb.insert(schema.noteTags).values([
        { noteId, tagId: tag1Id },
        { noteId, tagId: tag2Id },
      ])

      const result = await testDb.select()
        .from(schema.noteTags)
        .where(eq(schema.noteTags.noteId, noteId))

      expect(result).toHaveLength(2)
    })

    it('should remove a tag from a note', async () => {
      const noteId = nanoid()
      const tagId = nanoid()
      const now = new Date()

      await testDb.insert(schema.notes).values({
        id: noteId,
        title: 'Note with Tag',
        content: '',
        mode: 'text',
        ownerId: testUserId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })

      await testDb.insert(schema.tags).values({
        id: tagId,
        name: 'ToRemove',
        color: '#ff0000',
        ownerId: testUserId,
      })

      await testDb.insert(schema.noteTags).values({ noteId, tagId })

      // Verify tag was added
      let result = await testDb.select()
        .from(schema.noteTags)
        .where(eq(schema.noteTags.noteId, noteId))
      expect(result).toHaveLength(1)

      // Remove tag
      await testDb.delete(schema.noteTags)
        .where(eq(schema.noteTags.noteId, noteId))

      result = await testDb.select()
        .from(schema.noteTags)
        .where(eq(schema.noteTags.noteId, noteId))
      expect(result).toHaveLength(0)
    })
  })

})
