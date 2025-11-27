// backend/src/services/ai/adapters/OllamaAdapter.ts
import axios from 'axios';
import { AIProvider, AIResponse, AIOptions } from '../interfaces/AIProvider';

export class OllamaAdapter implements AIProvider {
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b';
  }

  // Helper to determine which model to use
  private getModel(options?: AIOptions): string {
    return options?.modelName || this.defaultModel;
  }

  async generate(systemPrompt: string, userPrompt: string, options?: AIOptions): Promise<AIResponse> {
    const modelToUse = this.getModel(options);
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: modelToUse, // Dynamic Model
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        options: {
          temperature: options?.temperature || 0.7
        }
      });
      return { text: response.data.response };
    } catch (error) {
      console.error(`Ollama Error (${modelToUse}):`, error);
      throw new Error(`Failed to generate with model ${modelToUse}`);
    }
  }

  async chat(systemPrompt: string, history: any[], newMessage: string, options?: AIOptions): Promise<AIResponse> {
    const modelToUse = this.getModel(options);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
      { role: 'user', content: newMessage }
    ];

    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: modelToUse, // Dynamic Model
        messages: messages,
        stream: false
      });
      return { text: response.data.message.content };
    } catch (error) {
      throw new Error(`Failed to chat with model ${modelToUse}`);
    }
  }

  // Dynamic Discovery
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((m: any) => m.name);
    } catch (error) {
      console.warn('Could not fetch Ollama models, returning default.');
      return [this.defaultModel];
    }
  }
}