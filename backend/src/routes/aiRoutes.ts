// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  correctGrammar, 
  summarizeMessage, 
  enhanceMessage, 
  expandMessage, 
  changeTone, 
  translateMessage, 
  chatWithAgent, 
  getAvailableModels,
  updateAIPreferences
} from '../controllers/aiController';

const router = Router();

router.use((req, res, next) => {
  console.log('---------------------------------');
  console.log('Incoming Request to:', req.path);
  console.log('1. Cookies (Parsed):', req.cookies); 
  console.log('2. Authorization Header:', req.headers.authorization);
  console.log('---------------------------------');
  next();
});

// 2. Authentication Middleware 
router.use(authenticateToken);

// 3. Debug Check (Third - To verify Auth worked)
router.use((req, res, next) => {
  console.log('Step 3: Post-Auth Check. User:', (req as any).user);
  next();
});

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
router.put('/preferences', updateAIPreferences);

export default router;