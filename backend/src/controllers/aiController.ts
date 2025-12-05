import { Request, Response } from 'express';
import { AIService, MessageTone } from '../services/ai/AIService'; 
import { supabase } from '../config/database'; 
import { AgentService } from '../services/ai/agent/AgentService';

const aiService = new AIService();
const agentService = new AgentService();

// Priority: 1. Request Body Override -> 2. User DB Preference -> 3. Server Default
const resolveConfig = async (req: Request) => {
  const { provider, model } = req.body;
  const userId = (req as any).user?.userId; 

  if (provider) return { provider, model };

  if (userId) {
    const { data } = await supabase
      .from('users') 
      .select('ai_provider, ai_model')
      .eq('id', userId)
      .single();

    if (data) {
      return { 
        provider: data.ai_provider, 
        model: data.ai_model || model 
      };
    }
  }

  return { provider: undefined, model: model };
};

// --- 1. Grammar Correction ---
export const correctGrammar = async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const config = await resolveConfig(req);
    const result = await aiService.correctGrammar(text, config.provider, config.model);
    res.json({ corrected: result.text, usedProvider: config.provider });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 2. Summarization ---
export const summarizeMessage = async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const config = await resolveConfig(req);
    const result = await aiService.summarizeMessage(text, config.provider, config.model);
    res.json({ summary: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 3. Enhancement (Clarity) ---
export const enhanceMessage = async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const config = await resolveConfig(req);
    const result = await aiService.enhanceMessage(text, config.provider, config.model);
    res.json({ enhanced: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 4. Expansion (Drafting) ---
export const expandMessage = async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const config = await resolveConfig(req);
    const result = await aiService.expandMessage(text, config.provider, config.model);
    res.json({ expanded: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 5. Tone Adjustment ---
export const changeTone = async (req: Request, res: Response) => {
  const { text, tone } = req.body;
  if (!text || !tone) return res.status(400).json({ error: 'Text and Tone are required' });

  const validTones: MessageTone[] = ['casual', 'formal', 'empathetic'];
  if (!validTones.includes(tone)) {
    return res.status(400).json({ error: 'Invalid tone.' });
  }

  try {
    const config = await resolveConfig(req);
    const result = await aiService.changeTone(text, tone as MessageTone, config.provider, config.model);
    res.json({ rewritten: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 6. Translation ---
export const translateMessage = async (req: Request, res: Response) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ error: 'Text and Target Language are required' });

  try {
    const config = await resolveConfig(req);
    const result = await aiService.translateMessage(text, targetLang, config.provider, config.model);
    res.json({ translated: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 7. Available Models ---
export const getAvailableModels = async (req: Request, res: Response) => {
  try {
    // If user has a preferred provider in DB, show models for THAT provider
    const config = await resolveConfig(req);
    // If config.provider is undefined, AIService defaults to env default
    const models = await aiService.getModels(config.provider);
    res.json({ models, activeProvider: config.provider || 'default' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
};

// --- 8. AI Agent Chat ---
export const chatWithAgent = async (req: Request, res: Response) => {
  const { sessionId, query } = req.body;
  if (!sessionId || !query) return res.status(400).json({ error: 'Session ID and Query are required' });

  try {
    const config = await resolveConfig(req);

    const responseText = await agentService.execute(sessionId, query);

    // Save the Interaction manually 
    await supabase.from('AIInteraction').insert({
      session_id: sessionId,
      user_query: query,
      ai_response: responseText,
      intent: 'info' 
    });

    res.json({ response: responseText, usedProvider: 'gemini-agent' });
  } catch (err: any) {
    console.error('Agent Error:', err);
    res.status(500).json({ error: 'AI Agent failed to respond' });
  }
};

// 9. Update AI preference 
export const updateAIPreferences = async (req: Request, res: Response) => {
  console.log('DEBUG: Full req.user object:', (req as any).user);
  const userId = (req as any).user?.userId;
  console.log('DEBUG: Extracted userId:', userId);
  const { provider, model } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
    console.log('DEBUG: Failed userId check');
  }

  const validProviders = ['ollama', 'huggingface', 'gemini'];
  if (provider && !validProviders.includes(provider.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid provider selected.' });
  }

  try {
    // 4. Update Supabase
    const { data, error } = await supabase
      .from('users') 
      .update({ 
        ai_provider: provider,
        ai_model: model 
      })
      .eq('id', userId)
      .select('ai_provider, ai_model')
      .single();

    if (error) throw error;

    res.json({ 
      message: 'Preferences updated successfully', 
      settings: data 
    });

  } catch (err: any) {
    console.error('Update Pref Error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};