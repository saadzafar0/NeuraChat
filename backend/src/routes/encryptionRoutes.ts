import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as encryptionController from '../controllers/encryptionController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Key management
router.post('/keys', encryptionController.uploadKeys);
router.get('/keys/:userId', encryptionController.getPreKeyBundle);
router.post('/rotate-prekey', encryptionController.rotateSignedPreKey);
router.post('/replenish-prekeys', encryptionController.replenishOneTimePreKeys);
router.get('/status', encryptionController.getEncryptionStatus);

// Session management
router.post('/session/:contactId', encryptionController.initializeSession);
router.delete('/session/:contactId', encryptionController.deleteSession);
router.get('/sessions', encryptionController.getActiveSessions);

export default router;
