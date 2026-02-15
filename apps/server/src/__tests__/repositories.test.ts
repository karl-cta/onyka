import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema.js'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'

// Create in-memory test database
const sqlite = new Database(':memory:')
const testDb = drizzle(sqlite, { schema })

// Run migrations
beforeAll(() => {
  // Create tables manually for in-memory db
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
  `)
})

afterAll(() => {
  sqlite.close()
})

describe('User Repository', () => {
  const { users } = schema

  it('should create a user', async () => {
    const id = nanoid()
    const now = new Date()

    await testDb.insert(users).values({
      id,
      username: 'testuser',
      passwordHash: 'hashed_password',
      name: 'Test User',
      createdAt: now,
      updatedAt: now,
    })

    const result = await testDb.select().from(users).where(eq(users.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].username).toBe('testuser')
    expect(result[0].name).toBe('Test User')
  })

  it('should find user by username', async () => {
    const result = await testDb
      .select()
      .from(users)
      .where(eq(users.username, 'testuser'))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test User')
  })
})

describe('Note Repository', () => {
  const { notes, users } = schema
  let userId: string

  beforeAll(async () => {
    // Get user from previous test
    const user = await testDb.select().from(users).limit(1)
    userId = user[0].id
  })

  it('should create a note', async () => {
    const id = nanoid()
    const now = new Date()

    await testDb.insert(notes).values({
      id,
      title: 'Test Note',
      content: 'Hello world',
      mode: 'text',
      ownerId: userId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const result = await testDb.select().from(notes).where(eq(notes.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test Note')
    expect(result[0].content).toBe('Hello world')
    expect(result[0].mode).toBe('text')
  })

  it('should update a note', async () => {
    const note = await testDb.select().from(notes).limit(1)
    const noteId = note[0].id

    await testDb
      .update(notes)
      .set({ title: 'Updated Title', content: 'Updated content' })
      .where(eq(notes.id, noteId))

    const result = await testDb.select().from(notes).where(eq(notes.id, noteId))
    expect(result[0].title).toBe('Updated Title')
    expect(result[0].content).toBe('Updated content')
  })

  it('should soft delete a note', async () => {
    const note = await testDb.select().from(notes).limit(1)
    const noteId = note[0].id

    await testDb
      .update(notes)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(notes.id, noteId))

    const result = await testDb.select().from(notes).where(eq(notes.id, noteId))
    expect(result[0].isDeleted).toBe(true)
    expect(result[0].deletedAt).not.toBeNull()
  })
})

describe('Folder Repository', () => {
  const { folders, users } = schema
  let userId: string

  beforeAll(async () => {
    const user = await testDb.select().from(users).limit(1)
    userId = user[0].id
  })

  it('should create a folder', async () => {
    const id = nanoid()
    const now = new Date()

    await testDb.insert(folders).values({
      id,
      name: 'Test Folder',
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    })

    const result = await testDb.select().from(folders).where(eq(folders.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Folder')
    expect(result[0].parentId).toBeNull()
  })

  it('should create a nested folder', async () => {
    const parent = await testDb.select().from(folders).limit(1)
    const parentId = parent[0].id

    const id = nanoid()
    const now = new Date()

    await testDb.insert(folders).values({
      id,
      name: 'Nested Folder',
      parentId,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    })

    const result = await testDb.select().from(folders).where(eq(folders.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Nested Folder')
    expect(result[0].parentId).toBe(parentId)
  })
})

describe('Tag Repository', () => {
  const { tags, noteTags, notes, users } = schema
  let userId: string
  let noteId: string

  beforeAll(async () => {
    const user = await testDb.select().from(users).limit(1)
    userId = user[0].id

    // Create a fresh note for tag tests
    noteId = nanoid()
    const now = new Date()
    await testDb.insert(notes).values({
      id: noteId,
      title: 'Tagged Note',
      content: '',
      mode: 'text',
      ownerId: userId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
  })

  it('should create a tag', async () => {
    const id = nanoid()

    await testDb.insert(tags).values({
      id,
      name: 'Important',
      color: '#ff0000',
      ownerId: userId,
    })

    const result = await testDb.select().from(tags).where(eq(tags.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Important')
    expect(result[0].color).toBe('#ff0000')
  })

  it('should assign tag to note', async () => {
    const tag = await testDb.select().from(tags).limit(1)
    const tagId = tag[0].id

    await testDb.insert(noteTags).values({
      noteId,
      tagId,
    })

    const result = await testDb.select().from(noteTags).where(eq(noteTags.noteId, noteId))
    expect(result).toHaveLength(1)
    expect(result[0].tagId).toBe(tagId)
  })
})
