import { Router } from 'express';
import {
  sendMessage,
  getChatMessages,
  updateMessageStatus,
  deleteMessage,
  editMessage,
  uploadMedia,
} from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/:chatId', sendMessage);
router.get('/:chatId', getChatMessages);
router.put('/:messageId/status', updateMessageStatus);
router.delete('/:messageId', deleteMessage);
router.put('/:messageId', editMessage);
router.post('/:messageId/media', uploadMedia);

export default router;
