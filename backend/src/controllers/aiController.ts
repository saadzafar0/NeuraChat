import { Request, Response } from 'express';
import { AIService, MessageTone } from '../services/ai/AIService'; 
import { supabase } from '../config/database'; 

const aiService = new AIService();

// --- 1. Grammar Correction ---
export const correctGrammar = async (req: Request, res: Response) => {
  const { text, model } = req.body; // Extract model override
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const result = await aiService.correctGrammar(text, model);
    res.json({ corrected: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 2. Summarization ---
export const summarizeMessage = async (req: Request, res: Response) => {
  const { text, model } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const result = await aiService.summarizeMessage(text, model);
    res.json({ summary: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 3. Enhancement (Clarity) ---
export const enhanceMessage = async (req: Request, res: Response) => {
  const { text, model } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const result = await aiService.enhanceMessage(text, model);
    res.json({ enhanced: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 4. Expansion (Drafting) ---
export const expandMessage = async (req: Request, res: Response) => {
  const { text, model } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const result = await aiService.expandMessage(text, model);
    res.json({ expanded: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 5. Tone Adjustment ---
export const changeTone = async (req: Request, res: Response) => {
  const { text, tone, model } = req.body;
  if (!text || !tone) return res.status(400).json({ error: 'Text and Tone are required' });

  // Validate tone type
  const validTones: MessageTone[] = ['casual', 'formal', 'empathetic'];
  if (!validTones.includes(tone)) {
    return res.status(400).json({ error: 'Invalid tone. Options: casual, formal, empathetic' });
  }

  try {
    const result = await aiService.changeTone(text, tone as MessageTone, model);
    res.json({ rewritten: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 6. Translation ---
export const translateMessage = async (req: Request, res: Response) => {
  const { text, targetLang, model } = req.body;
  if (!text || !targetLang) return res.status(400).json({ error: 'Text and Target Language are required' });

  try {
    const result = await aiService.translateMessage(text, targetLang, model);
    res.json({ translated: result.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// --- 7. Available Models (For UI Settings) ---
export const getAvailableModels = async (req: Request, res: Response) => {
  try {
    const models = await aiService.getModels();
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
};

// --- 8. AI Agent Chat ---
export const chatWithAgent = async (req: Request, res: Response) => {
  const { sessionId, query, userId, model } = req.body;
  
  if (!sessionId || !query) return res.status(400).json({ error: 'Session ID and Query are required' });

  try {
    // 1. Fetch recent context (Fix: Get NEWEST 5, then reverse to chronological)
    const { data: historyData } = await supabase
      .from('AIInteraction')
      .select('user_query, ai_response')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }) // Get newest first
      .limit(5);

    // Reverse to chronological order (Oldest -> Newest) for the LLM
    const history = historyData ? historyData.reverse().flatMap(interaction => [
      { role: 'user', content: interaction.user_query },
      { role: 'model', content: interaction.ai_response }
    ]) : [];

    // 2. Call AI Service
    const aiResult = await aiService.agentChat(history, query, model);

    // 3. Save Interaction to DB
    await supabase.from('AIInteraction').insert({
      session_id: sessionId,
      user_query: query,
      ai_response: aiResult.text,
      intent: 'info' 
    });

    res.json({ response: aiResult.text });
  } catch (err: any) {
    console.error('Agent Error:', err);
    res.status(500).json({ error: 'AI Agent failed to respond' });
  }
};