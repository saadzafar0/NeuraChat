import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as groupEncryptionController from '../controllers/groupEncryptionController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Group Encryption Routes
 * Base path: /api/group-encryption
 */

// Initialize group encryption (when creating a group)
router.post('/initialize', groupEncryptionController.initializeGroupEncryption);

// Get group encryption status
router.get('/status/:groupId', groupEncryptionController.getGroupEncryptionStatus);

// Rotate sender key for current user in a group
router.post('/rotate-sender-key/:groupId', groupEncryptionController.rotateSenderKey);

// Handle member added to group
router.post('/member-added', groupEncryptionController.onMemberAdded);

// Handle member removed from group
router.post('/member-removed', groupEncryptionController.onMemberRemoved);

// Rotate all sender keys in a group (after member removal)
router.post('/rotate-all/:groupId', groupEncryptionController.rotateAllSenderKeys);

// Encrypt a group message (for testing)
router.post('/encrypt', groupEncryptionController.encryptGroupMessage);

// Decrypt a group message (for testing)
router.post('/decrypt', groupEncryptionController.decryptGroupMessage);

export default router;
