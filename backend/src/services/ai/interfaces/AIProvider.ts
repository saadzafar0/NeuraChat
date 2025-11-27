export interface AIOptions {
  modelName?: string;  // Allow overriding the model per request
  temperature?: number; // Allow adjusting creativity
}

export interface AIResponse {
  text: string;
}

export interface AIProvider {
  generate(systemPrompt: string, userPrompt: string, options?: AIOptions): Promise<AIResponse>;
  
  chat(systemPrompt: string, history: any[], newMessage: string, options?: AIOptions): Promise<AIResponse>;

  getAvailableModels(): Promise<string[]>;
}