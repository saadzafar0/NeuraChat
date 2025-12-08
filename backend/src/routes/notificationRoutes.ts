import { Router } from 'express';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth'; 

const router = Router();

// Apply Auth Middleware to all routes
router.use(authenticateToken);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);  // Mark all as read
router.patch('/:id', markRead);          // Mark single notification as read

export default router;