import { AIProvider, AIOptions } from './interfaces/AIProvider';
import { OllamaAdapter } from './adapters/OllamaAdapter';
import { HuggingFaceAdapter } from './adapters/HuggingFaceAdapter';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { SYSTEM_PROMPTS, getTranslationPrompt } from './config/prompts';

export type MessageTone = 'casual' | 'formal' | 'empathetic';

export class AIService {
  private adapters: Map<string, AIProvider>;

  constructor() {
    this.adapters = new Map();

    this.adapters.set('ollama', new OllamaAdapter());
    this.adapters.set('huggingface', new HuggingFaceAdapter());
    this.adapters.set('gemini', new GeminiAdapter());

    console.log('[NeuraChat] AI Service initialized with multi-provider support.');
  }

  private getProvider(providerName?: string): AIProvider {
    const key = (providerName || process.env.AI_PROVIDER || 'ollama').toLowerCase();
    
    const adapter = this.adapters.get(key);
    if (!adapter) {
      console.warn(`[AIService] Provider '${key}' not found. Falling back to Ollama.`);
      return this.adapters.get('gemini')!;
    }
    return adapter;
  }

  private getOptions(modelOverride?: string): AIOptions {
    return modelOverride ? { modelName: modelOverride } : {};
  }

  // Methods now accept an optional 'provider' argument

  async correctGrammar(text: string, provider?: string, model?: string) {
    return this.getProvider(provider).generate(SYSTEM_PROMPTS.GRAMMAR, text, this.getOptions(model));
  }

  async summarizeMessage(text: string, provider?: string, model?: string) {
    return this.getProvider(provider).generate(SYSTEM_PROMPTS.SUMMARIZER, text, this.getOptions(model));
  }

  async agentChat(sessionHistory: any[], userQuery: string, provider?: string, model?: string) {
    return this.getProvider(provider).chat(SYSTEM_PROMPTS.AGENT, sessionHistory, userQuery, this.getOptions(model));
  }

  async enhanceMessage(text: string, provider?: string, model?: string) {
    return this.getProvider(provider).generate(SYSTEM_PROMPTS.ENHANCE, text, this.getOptions(model));
  }

  async expandMessage(text: string, provider?: string, model?: string) {
    return this.getProvider(provider).generate(SYSTEM_PROMPTS.EXPAND, text, this.getOptions(model));
  }

  async changeTone(text: string, tone: MessageTone, provider?: string, model?: string) {
    let prompt;
    switch (tone) {
      case 'casual': prompt = SYSTEM_PROMPTS.TONE_CASUAL; break;
      case 'formal': prompt = SYSTEM_PROMPTS.TONE_FORMAL; break;
      case 'empathetic': prompt = SYSTEM_PROMPTS.TONE_EMPATHETIC; break;
    }
    return this.getProvider(provider).generate(prompt!, text, this.getOptions(model));
  }

  async translateMessage(text: string, targetLang: string, provider?: string, model?: string) {
    const prompt = getTranslationPrompt(targetLang);
    return this.getProvider(provider).generate(prompt, text, this.getOptions(model));
  }

  async getModels(providerName?: string) {
    return this.getProvider(providerName).getAvailableModels();
  }
}