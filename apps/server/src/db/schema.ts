import { sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export const userRoleEnum = ['user', 'admin'] as const
export type UserRoleType = (typeof userRoleEnum)[number]

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  avatarUrl: text('avatar_url'),
  avatarColor: text('avatar_color').notNull().default('blue'),
  role: text('role', { enum: userRoleEnum }).notNull().default('user'),
  isDisabled: integer('is_disabled', { mode: 'boolean' }).notNull().default(false),
  disabledAt: integer('disabled_at', { mode: 'timestamp' }),
  disabledReason: text('disabled_reason'),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).notNull().default(false),
  trackingEnabled: integer('tracking_enabled', { mode: 'boolean' }).notNull().default(true),
  language: text('language', { enum: ['en', 'fr'] }).notNull().default('en'),
  theme: text('theme', { enum: ['light', 'dark'] }).notNull().default('dark'),
  darkThemeBase: text('dark_theme_base').notNull().default('default'),
  lightThemeBase: text('light_theme_base').notNull().default('default'),
  accentColor: text('accent_color').notNull().default('blue'),
  editorFontSize: text('editor_font_size').notNull().default('S'),
  editorFontFamily: text('editor_font_family').notNull().default('plus-jakarta-sans'),
  sidebarCollapsed: integer('sidebar_collapsed', { mode: 'boolean' }).notNull().default(false),
  sidebarWidth: integer('sidebar_width').notNull().default(288),
  tagsCollapsed: integer('tags_collapsed', { mode: 'boolean' }).notNull().default(false),
  tagsSectionHeight: integer('tags_section_height').notNull().default(120),
  sharedCollapsed: integer('shared_collapsed', { mode: 'boolean' }).notNull().default(false),
  sharedSectionHeight: integer('shared_section_height').notNull().default(150),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('Folder'),
    parentId: text('parent_id').references((): AnySQLiteColumn => folders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('folders_owner_idx').on(table.ownerId),
    index('folders_owner_parent_position_idx').on(table.ownerId, table.parentId, table.position),
  ]
)

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    mode: text('mode', { enum: ['text'] })
      .notNull()
      .default('text'),
    icon: text('icon').notNull().default('FileText'),
    position: integer('position').notNull().default(0),
    isQuickNote: integer('is_quick_note', { mode: 'boolean' }).notNull().default(false),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('notes_owner_idx').on(table.ownerId),
    index('notes_folder_idx').on(table.folderId),
    index('notes_folder_position_idx').on(table.folderId, table.position),
  ]
)

export const notePages = sqliteTable(
  'note_pages',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Page 1'),
    content: text('content').notNull().default(''),
    mode: text('mode', { enum: ['text'] })
      .notNull()
      .default('text'),
    position: integer('position').notNull().default(0),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('note_pages_note_idx').on(table.noteId),
    index('note_pages_position_idx').on(table.noteId, table.position),
  ]
)

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#3B82F6'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('tags_owner_idx').on(table.ownerId),
    uniqueIndex('tags_owner_name_idx').on(table.ownerId, table.name),
  ]
)

export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [index('note_tags_note_idx').on(table.noteId), index('note_tags_tag_idx').on(table.tagId)]
)

export const shares = sqliteTable(
  'shares',
  {
    id: text('id').primaryKey(),
    resourceId: text('resource_id').notNull(),
    resourceType: text('resource_type', { enum: ['note', 'folder', 'workspace'] }).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sharedWithId: text('shared_with_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission', { enum: ['read', 'edit', 'admin'] })
      .notNull()
      .default('read'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('shares_resource_idx').on(table.resourceId, table.resourceType),
    index('shares_shared_with_idx').on(table.sharedWithId),
  ]
)

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)]
)

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('system'),
  authDisabled: integer('auth_disabled', { mode: 'boolean' }).notNull().default(false),
  allowRegistration: integer('allow_registration', { mode: 'boolean' }).notNull().default(true),
  appName: text('app_name').notNull().default('Onyka'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    ipAddress: text('ip_address').notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    attemptedAt: integer('attempted_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('login_attempts_username_idx').on(table.username),
    index('login_attempts_ip_idx').on(table.ipAddress),
  ]
)

export const userStats = sqliteTable(
  'user_stats',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    wordsWritten: integer('words_written').notNull().default(0),
    notesCreated: integer('notes_created').notNull().default(0),
    notesEdited: integer('notes_edited').notNull().default(0),
    focusMinutes: integer('focus_minutes').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('user_stats_user_idx').on(table.userId),
    index('user_stats_date_idx').on(table.date),
    index('user_stats_user_date_idx').on(table.userId, table.date),
  ]
)

export const userAchievements = sqliteTable(
  'user_achievements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('user_achievements_user_idx').on(table.userId),
    index('user_achievements_achievement_idx').on(table.achievementId),
  ]
)

export const weeklyRecaps = sqliteTable(
  'weekly_recaps',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: text('week_start').notNull(),
    weekEnd: text('week_end').notNull(),
    wordsWritten: integer('words_written').notNull().default(0),
    notesCreated: integer('notes_created').notNull().default(0),
    notesEdited: integer('notes_edited').notNull().default(0),
    focusMinutes: integer('focus_minutes').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    isShown: integer('is_shown', { mode: 'boolean' }).notNull().default(false),
    shownAt: integer('shown_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('weekly_recaps_user_idx').on(table.userId),
    index('weekly_recaps_week_idx').on(table.weekStart),
    index('weekly_recaps_user_week_idx').on(table.userId, table.weekStart),
  ]
)

export const noteComments = sqliteTable(
  'note_comments',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => noteComments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('note_comments_note_idx').on(table.noteId),
    index('note_comments_user_idx').on(table.userId),
    index('note_comments_parent_idx').on(table.parentId),
  ]
)

export const thoughts = sqliteTable(
  'thoughts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    isExpired: integer('is_expired', { mode: 'boolean' }).notNull().default(false),
    convertedToNoteId: text('converted_to_note_id').references(() => notes.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('thoughts_owner_idx').on(table.ownerId),
    index('thoughts_expires_at_idx').on(table.expiresAt),
    index('thoughts_owner_pinned_idx').on(table.ownerId, table.isPinned),
  ]
)

export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('password_reset_tokens_user_idx').on(table.userId),
    index('password_reset_tokens_hash_idx').on(table.tokenHash),
  ]
)

export const emailVerificationTokens = sqliteTable(
  'email_verification_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('email_verification_tokens_user_idx').on(table.userId),
    index('email_verification_tokens_hash_idx').on(table.tokenHash),
  ]
)

export const recoveryCodes = sqliteTable(
  'recovery_codes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('recovery_codes_user_idx').on(table.userId),
  ]
)

export const emailOtpCodes = sqliteTable(
  'email_otp_codes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    purpose: text('purpose', { enum: ['login', 'enable_2fa', 'disable_2fa'] }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('email_otp_codes_user_idx').on(table.userId),
    index('email_otp_codes_expires_idx').on(table.expiresAt),
  ]
)

export const trustedDevices = sqliteTable(
  'trusted_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    label: text('label'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('trusted_devices_user_idx').on(table.userId),
    index('trusted_devices_token_hash_idx').on(table.tokenHash),
    index('trusted_devices_expires_idx').on(table.expiresAt),
  ]
)

export const uploads = sqliteTable(
  'uploads',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull().unique(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('uploads_owner_idx').on(table.ownerId),
    index('uploads_filename_idx').on(table.filename),
  ]
)

export const auditActionEnum = [
  'USER_LISTED',
  'USER_VIEWED',
  'USER_DISABLED',
  'USER_ENABLED',
  'USER_DELETED',
  'USER_ROLE_CHANGED',
  'USER_USERNAME_CHANGED',
  'USER_PASSWORD_RESET_SENT',
  'SETTINGS_UPDATED',
  'AUDIT_LOGS_VIEWED',
  'ADMIN_LOGIN',
] as const
export type AuditActionType = (typeof auditActionEnum)[number]

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action', { enum: auditActionEnum }).notNull(),
    targetType: text('target_type', { enum: ['user', 'system', 'settings'] }),
    targetId: text('target_id'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('audit_logs_admin_idx').on(table.adminId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_date_idx').on(table.createdAt),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
  ]
)
