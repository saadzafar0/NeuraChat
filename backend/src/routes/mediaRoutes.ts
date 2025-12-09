import { Router } from 'express';
import {
  uploadFile,
  getChatMedia,
  getMediaFile,
  deleteMediaFile,
  downloadMediaFile,
  getChatMediaStats,
} from '../controllers/mediaController';
import { authenticateToken } from '../middleware/auth';
import { upload, handleMulterError } from '../config/multer';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Upload file to chat
router.post('/upload', upload.single('file'), handleMulterError, uploadFile);

// Get all media files for a chat
router.get('/chat/:chatId', getChatMedia);

// Get media statistics for a chat
router.get('/chat/:chatId/stats', getChatMediaStats);

// Get single media file details
router.get('/:fileId', getMediaFile);

// Download media file
router.get('/:fileId/download', downloadMediaFile);

// Delete media file
router.delete('/:fileId', deleteMediaFile);

export default router;
