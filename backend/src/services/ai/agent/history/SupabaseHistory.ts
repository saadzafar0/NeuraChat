import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { supabase } from "../../../../config/database";

export class SupabaseHistory extends BaseListChatMessageHistory {
  lc_namespace = ["neurachat", "history"];

  constructor(private sessionId: string) {
    super();
  }

  // Fetch Context: Read existing Q&A pairs and converts to LangChain format
  async getMessages(): Promise<BaseMessage[]> {
    const { data, error } = await supabase
      .from('ai_interactions')
      .select('user_query, ai_response')
      .eq('session_id', this.sessionId)
      .order('created_at', { ascending: true }); 

    if (error) {
      console.error("History Fetch Error:", error);
      return [];
    }

    const messages: BaseMessage[] = [];
    data.forEach((row) => {
      if (row.user_query) messages.push(new HumanMessage(row.user_query));
      if (row.ai_response) messages.push(new AIMessage(row.ai_response));
    });

    return messages;
  }

  // 2. Add Message: LangChain tries to save every step. 
  async addMessage(message: BaseMessage): Promise<void> {
  }
}