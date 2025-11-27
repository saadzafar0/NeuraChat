// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth'; // Ensure this matches your middleware export
import { 
  correctGrammar, 
  summarizeMessage, 
  enhanceMessage, 
  expandMessage, 
  changeTone, 
  translateMessage, 
  chatWithAgent, 
  getAvailableModels 
} from '../controllers/aiController';

const router = Router();

router.use(authenticateToken);

// --- Text Utilities ---
router.post('/grammar', correctGrammar);
router.post('/summarize', summarizeMessage);
router.post('/enhance', enhanceMessage);
router.post('/expand', expandMessage);
router.post('/tone', changeTone);
router.post('/translate', translateMessage);

// --- AI Agent ---
router.post('/chat', chatWithAgent);

// --- Configuration ---
router.get('/models', getAvailableModels);

export default router;