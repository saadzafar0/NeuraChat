import axios from 'axios';
import { AIProvider, AIResponse, AIOptions } from '../interfaces/AIProvider';

export class GeminiAdapter implements AIProvider {
  private apiKey: string;
  private defaultModel = 'gemini-2.5-flash';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  // Helper to construct the dynamic URL
  private getUrl(model: string, action: 'generateContent'): string {
    return `${this.baseUrl}/${model}:${action}?key=${this.apiKey}`;
  }

  async generate(systemPrompt: string, userPrompt: string, options?: AIOptions): Promise<AIResponse> {
    const model = options?.modelName || this.defaultModel;
    
    const payload = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\nUser Input: ${userPrompt}` }]
      }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7 // Default to 0.7 if not provided
      }
    };

    try {
      const response = await axios.post(this.getUrl(model, 'generateContent'), payload);
      
      // Safety check for empty responses
      const candidate = response.data.candidates?.[0];
      if (!candidate || !candidate.content) {
        throw new Error('Gemini returned no content. It might have blocked the response.');
      }

      return { text: candidate.content.parts[0].text };
    } catch (error: any) {
      console.error(`Gemini (${model}) Error:`, error.response?.data || error.message);
      throw new Error('Gemini Request Failed');
    }
  }

  async chat(systemPrompt: string, history: any[], newMessage: string, options?: AIOptions): Promise<AIResponse> {
    const model = options?.modelName || this.defaultModel;

    // Gemini structure mapping
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Add context + new message
    contents.push({
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\n${newMessage}` }]
    });

    const payload = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7
      }
    };

    try {
      const response = await axios.post(this.getUrl(model, 'generateContent'), payload);
      const text = response.data.candidates[0].content.parts[0].text;
      return { text };
    } catch (error: any) {
      console.error(`Gemini Chat (${model}) Error:`, error.response?.data || error.message);
      throw new Error('Gemini Chat Failed');
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      // Fetches list of models from Google
      const response = await axios.get(`${this.baseUrl}?key=${this.apiKey}`);
      const models = response.data.models || [];
      
      return models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', '')); 
    } catch (error) {
      console.warn('Failed to fetch Gemini models, returning default.');
      return ['gemini-2.5-flash', 'gemini-1.5-flash'];
    }
  }
}