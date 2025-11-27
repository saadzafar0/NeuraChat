import { Router } from 'express';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth'; 

const router = Router();

// Apply Auth Middleware to all routes
router.use(authenticateToken);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);

export default router;