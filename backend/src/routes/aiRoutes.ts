import { Router } from 'express';
import {
  createAISession,
  getUserAISessions,
  getSessionInteractions,
  sendAIMessage,
  updateAISession,
  deleteAISession,
} from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/sessions', createAISession);
router.get('/sessions', getUserAISessions);
router.get('/sessions/:sessionId', getSessionInteractions);
router.post('/sessions/:sessionId/message', sendAIMessage);
router.put('/sessions/:sessionId', updateAISession);
router.delete('/sessions/:sessionId', deleteAISession);

export default router;
