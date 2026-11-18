import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.js'
import { createTestDb } from '../helpers/test-db.js'

const { db: testDb, sqlite } = createTestDb()
let testUserId: string

beforeAll(() => {
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
