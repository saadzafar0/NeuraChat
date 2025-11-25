import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getUserContacts,
  updateLastSeen,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/profile/:userId', getUserProfile);
router.put('/profile', updateUserProfile);
router.get('/search', searchUsers);
router.get('/contacts', getUserContacts);
router.put('/last-seen', updateLastSeen);

export default router;
