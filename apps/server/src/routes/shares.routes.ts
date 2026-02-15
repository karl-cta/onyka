import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { sharingService } from '../services/sharing.service.js'
import { authenticate } from '../middleware/auth.js'
import { emitToUser } from '../websocket/collaboration.js'
import { noteRepository } from '../repositories/note.repository.js'
import { folderRepository } from '../repositories/folder.repository.js'
import { userRepository } from '../repositories/user.repository.js'

const router: RouterType = Router()

router.use(authenticate)

const createShareSchema = z.object({
  resourceId: z.string().min(1, 'Resource ID is required'),
  resourceType: z.enum(['note', 'folder', 'workspace']),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long'),
  permission: z.enum(['read', 'edit', 'admin']),
})

const updateShareSchema = z.object({
  permission: z.enum(['read', 'edit', 'admin']),
})

const listSharesQuerySchema = z.object({
  resourceId: z.string().optional(),
  resourceType: z.enum(['note', 'folder', 'workspace']).optional(),
  type: z.enum(['shared_by_me', 'shared_with_me']).optional(),
})

router.get('/', async (req, res, next) => {
  try {
    const { resourceId, resourceType, type } = listSharesQuerySchema.parse(req.query)

    if (resourceId && resourceType) {
      const shares = await sharingService.getSharesForResource(
        req.userId!,
        resourceId,
        resourceType
      )
      // Transform ShareWithUser to Collaborator format for frontend
      const collaborators = shares.map((share) => ({
        id: share.id,
        username: share.sharedWith.username,
        name: share.sharedWith.name,
        avatarUrl: share.sharedWith.avatarUrl,
        avatarColor: share.sharedWith.avatarColor,
        permission: share.permission,
      }))
      return res.json({ collaborators })
    }

    if (type === 'shared_with_me') {
      const shares = await sharingService.getSharedWithMe(req.userId!)
      return res.json({ shares })
    }

    const shares = await sharingService.getMyShares(req.userId!)
    res.json({ shares })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = createShareSchema.parse(req.body)
    const share = await sharingService.share(req.userId!, input)

    // Notify the recipient via WebSocket that a resource was shared with them
    // Get resource details for the notification
    let resourceTitle = ''
    if (input.resourceType === 'note') {
      const note = await noteRepository.findById(input.resourceId)
      resourceTitle = note?.title || 'Untitled'
    } else if (input.resourceType === 'folder') {
      const folder = await folderRepository.findById(input.resourceId)
      resourceTitle = folder?.name || 'Untitled'
    }

    // Get the sharer's info
    const sharer = await userRepository.findById(req.userId!)

    const notification = {
      shareId: share.id,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      resourceTitle,
      permission: input.permission,
      sharedBy: {
        id: sharer?.id,
        username: sharer?.username,
        name: sharer?.name,
      },
      sharedWithUserId: share.sharedWith.id,
    }

    // Emit only to the target user's sockets (not broadcast)
    emitToUser(share.sharedWith.id, 'resource-shared', notification)

    res.status(201).json({ share })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { permission } = updateShareSchema.parse(req.body)
    const share = await sharingService.updatePermission(req.params.id, req.userId!, permission)
    res.json({ share })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await sharingService.revoke(req.params.id, req.userId!)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

export default router
