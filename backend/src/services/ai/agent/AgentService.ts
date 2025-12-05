import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tools, toolsByName } from "./tools";
import { SupabaseHistory } from "./history/SupabaseHistory";

export class AgentService {
  private llm: ChatGoogleGenerativeAI;

  constructor() {
    // Initialize Model with tool binding
    const baseLlm = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0,
    });

    // Bind tools to the model
    this.llm = baseLlm.bindTools(tools) as ChatGoogleGenerativeAI;
  }

  async execute(sessionId: string, query: string): Promise<string> {
    // Fetch chat history from Supabase
    const history = new SupabaseHistory(sessionId);
    const previousMessages = await history.getMessages();

    // Build messages array with system prompt, history, and new query
    const messages: BaseMessage[] = [
      new SystemMessage("You are NeuraChat, an intelligent assistant. You have access to tools. Use them when necessary."),
      ...previousMessages,
      new HumanMessage(query),
    ];

    // Agent loop - keep running until no more tool calls
    let response = await this.llm.invoke(messages);
    
    while (response.tool_calls && response.tool_calls.length > 0) {
      // Add the AI response with tool calls to messages
      messages.push(response);

      // Execute each tool call and add results
      for (const toolCall of response.tool_calls) {
        const tool = toolsByName[toolCall.name];
        if (tool) {
          const toolResult = await tool.invoke(toolCall.args);
          messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          }));
        }
      }

      // Get next response
      response = await this.llm.invoke(messages);
    }

    // Extract final text response
    const content = response.content;
    return typeof content === "string" 
      ? content 
      : JSON.stringify(content) || "No response generated.";
  }
}