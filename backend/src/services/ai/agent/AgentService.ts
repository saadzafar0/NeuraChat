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
        model: model || "gemini-2.5-flash",
        maxOutputTokens: 2048,
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.3,
      });
      return baseLlm.bindTools(tools) as BaseChatModel;
    }

    // Fallback to Gemini for unsupported providers (tool calling requirement)
    console.warn(`[Agent] Provider '${provider}' doesn't support tool calling. Using Gemini.`);
    const fallbackLlm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
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
    let userContext = '';
    let systemPrompt = `You are NeuraChat AI Assistant, a powerful copilot integrated into the NeuraChat messaging application.

**Your Primary Role:**
Help users manage their chats, send messages, find information, and be productive within NeuraChat.

**CRITICAL RULES FOR SENDING MESSAGES:**
1. When a user says "message [person]" or "tell [person]", you MUST use the send_message tool
2. For the chat_name parameter, use the recipient's USERNAME (not full name)
3. The sender_username should be the current user's username (provided in context below)
4. ALWAYS confirm success or failure after sending

**Example Flow for "Tell John I'll be late":**
1. If you know John's username → Use send_message(chat_name="john_doe", sender_username="current_user", content="I'll be late")
2. If you don't know John's username → First use search_users(query="John") to find the username

**Available Capabilities:**

📱 **Chat Management:**
- get_user_chats: List all chats (shows participant names for private chats)
- find_private_chat: Find existing private chat between two users
- create_chat: Create new private or group chat
- get_chat_participants: List members of a chat

💬 **Messaging:**
- send_message: Send a message (use recipient's username for private chats)
- search_messages: Search message content globally
- search_chat_messages: Search within a specific chat
- summarize_chat: Get summary of recent messages
- edit_message: Edit a message by ID
- delete_message: Delete a message by ID
- react_to_message: Add emoji reaction

👥 **User Management:**
- search_users: Find users by name/username
- get_user_profile: Get detailed user info
- update_status_message: Update user's status
- block_user / unblock_user / get_blocked_users: Manage blocked users

👥 **Group Administration:**
- add_group_participant: Add user to group
- remove_group_participant: Remove user from group
- update_group_info: Rename group
- leave_chat: Leave a chat

📁 **Media & Files:**
- get_chat_media: List files in a chat
- search_media: Search files by type

🔔 **Notifications & Productivity:**
- get_notifications: Get user's notifications
- set_reminder: Create a reminder
- translate_message: Translate a message

📞 **History:**
- get_call_history: View call logs
- get_ai_sessions: View AI conversation history

⏰ **Utilities:**
- get_current_time: Get current date/time

**Response Style:**
- Be concise and helpful
- Confirm actions taken
- If something fails, explain why and suggest alternatives
- Use emojis sparingly for clarity`;

    if (userId) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('username, full_name, ai_provider, ai_model')
          .eq('id', userId)
          .single();
        if (user) {
          userContext = `\n\n**Current User Context:**
- User ID: ${userId}
- Username: ${user.username}
- Full Name: ${user.full_name || 'Not set'}

When this user asks to send a message, use "${user.username}" as the sender_username parameter.`;
          systemPrompt += userContext;
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