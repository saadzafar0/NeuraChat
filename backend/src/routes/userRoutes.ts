import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getUserContacts,
  updateLastSeen,
  changePassword,
  uploadAvatar,
  deleteAvatar,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../config/multer';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/profile/:userId', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.delete('/avatar', deleteAvatar);
router.get('/search', searchUsers);
router.get('/contacts', getUserContacts);
router.put('/last-seen', updateLastSeen);
router.put('/change-password', changePassword);

export default router;
