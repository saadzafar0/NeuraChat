import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { tools, toolsByName } from "./tools";
import { SupabaseHistory } from "./history/SupabaseHistory";
import { supabase } from "../../../config/database";

interface UserPreferences {
  provider?: string;
  model?: string;
}

export class AgentService {
  private createLLM(preferences?: UserPreferences): BaseChatModel {
    const provider = preferences?.provider?.toLowerCase() || process.env.AI_PROVIDER || 'gemini';
    const model = preferences?.model;

    // Currently only Gemini supports tool calling with LangChain
    // For other providers, we fall back to Gemini
    if (provider === 'gemini' || !provider) {
      const baseLlm = new ChatGoogleGenerativeAI({
        model: model || "gemini-2.0-flash",
        maxOutputTokens: 2048,
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.3,
      });
      return baseLlm.bindTools(tools) as BaseChatModel;
    }

    // Fallback to Gemini for unsupported providers (tool calling requirement)
    console.warn(`[Agent] Provider '${provider}' doesn't support tool calling. Using Gemini.`);
    const fallbackLlm = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.3,
    });
    return fallbackLlm.bindTools(tools) as BaseChatModel;
  }

  async execute(sessionId: string, query: string, userId?: string): Promise<string> {
    const history = new SupabaseHistory(sessionId);
    const previousMessages = (await history.getMessages()) || [];

    // Fetch user preferences and context
    let userPreferences: UserPreferences = {};
    let systemPrompt = `You are NeuraChat AI Assistant, a powerful copilot integrated into the NeuraChat messaging application. 

Your capabilities include:

**Core Features:**
- Searching for users and messages
- Managing chats and notifications
- Summarizing conversations
- Accessing call history and AI session data
- Updating user preferences and profiles

**Messaging Actions:**
- Sending messages on behalf of users (e.g., "Tell John I'll be late")
- Editing and deleting messages
- Adding emoji reactions to messages

**Group Administration:**
- Adding/removing participants from group chats
- Renaming groups and updating group info
- Leaving chats on behalf of users

**Media & Files:**
- Listing media shared in chats
- Searching for specific file types

**Privacy & Security:**
- Blocking and unblocking users
- Listing blocked users

**Productivity:**
- Translating messages to different languages
- Setting reminders and notifications

Always be helpful, concise, and proactive. Use your tools when needed to provide accurate information and take actions on behalf of the user.`;

    if (userId) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('username, full_name, ai_provider, ai_model')
          .eq('id', userId)
          .single();
        if (user) {
          systemPrompt += `\n\nYou are assisting ${user.full_name || user.username} (User ID: ${userId}).`;
          userPreferences = {
            provider: user.ai_provider,
            model: user.ai_model
          };
        }
      } catch (err) {
        console.error('[Agent] Failed to fetch user context:', err);
      }
    }

    // Create LLM with user preferences
    const llm = this.createLLM(userPreferences);

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...previousMessages,
      new HumanMessage(query),
    ];

    // 1. Initial Call
    let response = await llm.invoke(messages);
    
    // 2. Tool Execution Loop
    // Safety: Limit max iterations to prevent infinite loops (cost protection)
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.tool_calls && response.tool_calls.length > 0 && iterations < MAX_ITERATIONS) {
      messages.push(response);
      iterations++;

      for (const toolCall of response.tool_calls) {
        const tool = toolsByName[toolCall.name];

        // Safety: Handle hallucinations (AI calling a tool that doesn't exist)
        if (!tool) {
          console.error(`[Agent] Tool not found: ${toolCall.name}`);
          messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: `Error: Tool '${toolCall.name}' does not exist.`,
          }));
          continue;
        }

        try {
          // Safety: Wrap execution in try/catch so one failure doesn't crash the server
          console.log(`[Agent] Calling tool: ${toolCall.name}`);
          const toolResult = await tool.invoke(toolCall.args);
          
          messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          }));
        } catch (error: any) {
          console.error(`[Agent] Tool Execution Error:`, error);
          // Feed the error back to the AI so it can apologize to the user
          messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: `Error executing tool: ${error.message}`,
          }));
        }
      }

      // Get next response from AI
      response = await llm.invoke(messages);
    }

    // Extract final response
    const content = response.content;
    const finalResponse = typeof content === "string" 
      ? content 
      : JSON.stringify(content) || "No response generated.";

    // Log successful completion
    console.log(`[Agent] Session ${sessionId} completed in ${iterations} tool iterations`);

    return finalResponse;
  }
}