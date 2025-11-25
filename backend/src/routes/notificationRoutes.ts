import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getUserNotifications);
router.put('/:notificationId/read', markNotificationRead);
router.put('/read-all', markAllNotificationsRead);
router.delete('/:notificationId', deleteNotification);

export default router;
