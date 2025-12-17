import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { 
  getUserNotifications, 
  markNotificationRead, 
  markAllNotificationsRead 
} from '../services/notificationService.js'

const router = Router()

// Get user notifications
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { limit = 20, unreadOnly = false } = req.query
  
  const notifications = await getUserNotifications(userId, {
    limit: parseInt(limit),
    unreadOnly: unreadOnly === 'true'
  })
  
  res.json({ notifications })
}))

// Mark notification as read
router.patch('/:id/read', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  const success = await markNotificationRead(id, userId)
  
  if (!success) {
    return res.status(500).json({ error: 'Failed to mark notification as read' })
  }
  
  res.json({ success: true })
}))

// Mark all notifications as read
router.post('/read-all', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  
  const success = await markAllNotificationsRead(userId)
  
  if (!success) {
    return res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
  
  res.json({ success: true })
}))

export default router
