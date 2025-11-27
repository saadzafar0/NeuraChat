import { AIProvider, AIOptions } from './interfaces/AIProvider'; // Import AIOptions
import { OllamaAdapter } from './adapters/OllamaAdapter';
import { HuggingFaceAdapter } from './adapters/HuggingFaceAdapter';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { SYSTEM_PROMPTS, getTranslationPrompt } from './config/prompts';

export type MessageTone = 'casual' | 'formal' | 'empathetic';

export class AIService {
  private provider: AIProvider;

  constructor() {
    const providerType = process.env.AI_PROVIDER?.toLowerCase() || 'ollama';
    console.log(`[NeuraChat] AI Service initialized with: ${providerType}`);
    
    switch (providerType) {
      case 'gemini': this.provider = new GeminiAdapter(); break;
      case 'huggingface': this.provider = new HuggingFaceAdapter(); break;
      case 'ollama': default: this.provider = new OllamaAdapter(); break;
    }
  }

  /**
   * Helper to construct options object
   */
  private getOptions(modelOverride?: string): AIOptions | undefined {
    return modelOverride ? { modelName: modelOverride } : undefined;
  }

  async correctGrammar(text: string, modelOverride?: string) {
    return this.provider.generate(SYSTEM_PROMPTS.GRAMMAR, text, this.getOptions(modelOverride));
  }

  async summarizeMessage(text: string, modelOverride?: string) {
    return this.provider.generate(SYSTEM_PROMPTS.SUMMARIZER, text, this.getOptions(modelOverride));
  }

  async agentChat(sessionHistory: any[], userQuery: string, modelOverride?: string) {
    return this.provider.chat(SYSTEM_PROMPTS.AGENT, sessionHistory, userQuery, this.getOptions(modelOverride));
  }

  async enhanceMessage(text: string, modelOverride?: string) {
    return this.provider.generate(SYSTEM_PROMPTS.ENHANCE, text, this.getOptions(modelOverride));
  }

  async expandMessage(text: string, modelOverride?: string) {
    return this.provider.generate(SYSTEM_PROMPTS.EXPAND, text, this.getOptions(modelOverride));
  }

  async changeTone(text: string, tone: MessageTone, modelOverride?: string) {
    let prompt;
    switch (tone) {
      case 'casual': prompt = SYSTEM_PROMPTS.TONE_CASUAL; break;
      case 'formal': prompt = SYSTEM_PROMPTS.TONE_FORMAL; break;
      case 'empathetic': prompt = SYSTEM_PROMPTS.TONE_EMPATHETIC; break;
    }
    return this.provider.generate(prompt!, text, this.getOptions(modelOverride));
  }

  async translateMessage(text: string, targetLanguage: string, modelOverride?: string) {
    const prompt = getTranslationPrompt(targetLanguage);
    return this.provider.generate(prompt, text, this.getOptions(modelOverride));
  }

  async getModels() {
    return this.provider.getAvailableModels();
  }
}