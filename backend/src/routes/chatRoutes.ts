import { Router } from 'express';
import {
  createChat,
  getUserChats,
  getChatDetails,
  updateChat,
  addParticipant,
  removeParticipant,
  leaveChat,
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createChat);
router.get('/', getUserChats);
router.get('/:chatId', getChatDetails);
router.put('/:chatId', updateChat);
router.post('/:chatId/participants', addParticipant);
router.delete('/:chatId/participants/:userId', removeParticipant);
router.delete('/:chatId/leave', leaveChat);

export default router;
