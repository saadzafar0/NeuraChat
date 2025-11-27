import OpenAI from 'openai';
import { AIProvider, AIResponse, AIOptions } from '../interfaces/AIProvider';

export class HuggingFaceAdapter implements AIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    const apiKey = process.env.HF_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ HF_API_KEY is missing. AI features will fail.');
    }

    this.client = new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: apiKey,
    });

    this.defaultModel = 'Qwen/Qwen2.5-7B-Instruct'; 
  }

  async generate(systemPrompt: string, userPrompt: string, options?: AIOptions): Promise<AIResponse> {
    const model = options?.modelName || this.defaultModel;

    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: 500,
      });

      return { text: completion.choices[0]?.message?.content || '' };
    } catch (error: any) {
      console.error(`HF Adapter Error (${model}):`, error.message);
      throw new Error('Hugging Face Inference Failed');
    }
  }

  async chat(systemPrompt: string, history: any[], newMessage: string, options?: AIOptions): Promise<AIResponse> {
    const model = options?.modelName || this.defaultModel;

    // FIX: Explicitly type the array and use 'as const' or explicit casts for roles
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        // Cast role to strict literal types expected by OpenAI
        role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.content || '' 
      })),
      { role: 'user', content: newMessage }
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: 500,
      });

      return { text: completion.choices[0]?.message?.content || '' };
    } catch (error: any) {
      console.error(`HF Chat Error (${model}):`, error.message);
      throw new Error('Hugging Face Chat Failed');
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      'Qwen/Qwen2.5-7B-Instruct'
    ];
  }
}