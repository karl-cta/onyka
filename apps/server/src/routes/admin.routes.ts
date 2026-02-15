import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { createAuditLog } from '../middleware/audit.js'
import { adminService } from '../services/admin.service.js'
import { passwordResetService } from '../services/password-reset.service.js'
import { auditLogRepository } from '../repositories/index.js'

const router: RouterType = Router()

// All admin routes require authentication and admin role
router.use(authenticate)
router.use(requireAdmin)

// GET /api/admin/users - List users (metadata only)
router.get('/users', async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(50),
      search: z.string().optional(),
      status: z.enum(['active', 'disabled', 'all']).optional(),
    })

    const query = querySchema.parse(req.query)

    const result = await adminService.listUsers({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    })

    res.json({
      users: result.users,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/users/:id/disable - Disable a user
router.patch('/users/:id/disable', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      reason: z.string().max(500).optional(),
    })

    const { reason } = bodySchema.parse(req.body)
    const targetId = req.params.id

    await adminService.disableUser(targetId, req.userId!, reason)

    // Log the action
    await createAuditLog(req, 'USER_DISABLED', {
      targetType: 'user',
      targetId,
      metadata: { reason },
    })

    res.json({ success: true, message: 'User disabled' })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/users/:id/enable - Enable a user
router.patch('/users/:id/enable', async (req, res, next) => {
  try {
    const targetId = req.params.id

    await adminService.enableUser(targetId)

    // Log the action
    await createAuditLog(req, 'USER_ENABLED', {
      targetType: 'user',
      targetId,
    })

    res.json({ success: true, message: 'User enabled' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', async (req, res, next) => {
  try {
    const targetId = req.params.id

    // Get username before deletion for audit log
    const { userRepository } = await import('../repositories/index.js')
    const targetUser = await userRepository.findById(targetId)
    const targetUsername = targetUser?.username

    await adminService.deleteUser(targetId, req.userId!)

    // Log the action
    await createAuditLog(req, 'USER_DELETED', {
      targetType: 'user',
      targetId,
      metadata: { username: targetUsername },
    })

    res.json({ success: true, message: 'User deleted' })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/users/:id/role - Change user role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      role: z.enum(['user', 'admin']),
    })

    const { role } = bodySchema.parse(req.body)
    const targetId = req.params.id

    await adminService.changeUserRole(targetId, req.userId!, role)

    // Log the action
    await createAuditLog(req, 'USER_ROLE_CHANGED', {
      targetType: 'user',
      targetId,
      metadata: { newRole: role },
    })

    res.json({ success: true, message: `User role changed to ${role}` })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/users/:id/username - Change a user's username
router.patch('/users/:id/username', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore'),
    })

    const { username } = bodySchema.parse(req.body)
    const targetId = req.params.id

    await adminService.changeUsername(targetId, username)

    // Log the action
    await createAuditLog(req, 'USER_USERNAME_CHANGED', {
      targetType: 'user',
      targetId,
      metadata: { newUsername: username },
    })

    res.json({ success: true, message: 'Username changed' })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/users/:id/send-password-reset - Send password reset email
router.post('/users/:id/send-password-reset', async (req, res, next) => {
  try {
    const targetId = req.params.id

    await passwordResetService.adminRequestReset(targetId)

    // Log the action
    await createAuditLog(req, 'USER_PASSWORD_RESET_SENT', {
      targetType: 'user',
      targetId,
    })

    res.json({ success: true, message: 'Password reset email sent' })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/stats - System statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getSystemStats()
    res.json({ stats })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/reindex-search - Rebuild the full-text search index
router.post('/reindex-search', async (req, res, next) => {
  try {
    const result = await adminService.reindexSearch()

    // Log the action
    await createAuditLog(req, 'SETTINGS_UPDATED', {
      targetType: 'system',
      targetId: 'search-index',
      metadata: { action: 'reindex', indexedCount: result.indexedCount },
    })

    res.json({
      success: true,
      message: `Search index rebuilt with ${result.indexedCount} notes`,
      indexedCount: result.indexedCount,
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/admin/audit-logs - Audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(500).default(100),
      action: z
        .enum([
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
        ])
        .optional(),
      adminId: z.string().optional(),
      targetId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })

    const query = querySchema.parse(req.query)

    const result = await auditLogRepository.findAll({
      page: query.page,
      limit: query.limit,
      action: query.action,
      adminId: query.adminId,
      targetId: query.targetId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    })

    res.json({
      logs: result.logs,
      pagination: {
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(result.total / query.limit),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
