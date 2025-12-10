import { Router } from 'express';
import {
  initiateCall,
  joinCall,
  leaveCall,
  endCall,
  getCallParticipants,
  getCallHistory,
  createCallLog,
  getUserCallLogs,
} from '../controllers/callController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', initiateCall);
router.get('/logs', getUserCallLogs); // Must be before /:callId routes to avoid conflict
router.post('/:callId/join', joinCall);
router.post('/:callId/leave', leaveCall);
router.post('/:callId/end', endCall);
router.get('/:callId/participants', getCallParticipants);
router.get('/history/:chatId', getCallHistory);
router.post('/:callId/log', createCallLog);

export default router;
