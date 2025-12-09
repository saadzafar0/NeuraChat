// API Client for NeuraChat Backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface RequestOptions extends RequestInit {
  body?: any;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      credentials: 'include', // CRITICAL: Include httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    // Stringify body if it's an object
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses (like 204 No Content)
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = {};
      }

      if (!response.ok) {
        // Normalize the error shape so callers can inspect status/message/data
        const normalizedError = {
          status: response.status,
          message: data?.error || data?.message || response.statusText || 'Request failed',
          data,
        };
        throw normalizedError;
      }

      return data as T;
    } catch (error: any) {
      // Network or parsing errors
      if (error?.status) {
        throw error;
      }
      const normalizedError = {
        status: 0,
        message: error?.message || 'Network error',
        data: error ?? null,
      };
      throw normalizedError;
    }
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    username: string;
    full_name: string;
  }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: data,
    });
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me', {
      method: 'GET',
    });
  }

  // User endpoints
  async getUserProfile(userId: string) {
    return this.request(`/api/users/profile/${userId}`, {
      method: 'GET',
    });
  }

  async updateUserProfile(data: {
    username?: string;
    full_name?: string;
    avatar_url?: string | null;
    status_message?: string | null;
  }) {
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async searchUsers(query: string) {
    return this.request(`/api/users/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  async getUserContacts() {
    return this.request('/api/users/contacts', {
      method: 'GET',
    });
  }

  async updateLastSeen() {
    return this.request('/api/users/last-seen', {
      method: 'PUT',
    });
  }

  // Chat endpoints
  async createChat(data: {
    type: 'private' | 'group';
    name?: string;
    participants: string[];
  }) {
    return this.request('/api/chats', {
      method: 'POST',
      body: data,
    });
  }

  async getUserChats() {
    return this.request('/api/chats', {
      method: 'GET',
    });
  }

  async getChatDetails(chatId: string) {
    return this.request(`/api/chats/${chatId}`, {
      method: 'GET',
    });
  }

  // Call endpoints
  async createCall(data: { chatId: string; type?: 'audio' | 'video' }) {
    return this.request('/api/calls', {
      method: 'POST',
      body: data,
    });
  }

  async joinCall(callId: string) {
    return this.request(`/api/calls/${callId}/join`, {
      method: 'POST',
    });
  }

  async getRtmToken() {
    return this.request('/api/agora/rtm-token', {
      method: 'GET',
    });
  }

  async updateChat(chatId: string, data: { name: string }) {
    return this.request(`/api/chats/${chatId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async leaveChat(chatId: string) {
    return this.request(`/api/chats/${chatId}/leave`, {
      method: 'DELETE',
    });
  }

  // Message endpoints
  async getChatMessages(chatId: string, limit = 50, offset = 0) {
    return this.request(`/api/messages/${chatId}?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  }

  async deleteMessage(messageId: string) {
    return this.request(`/api/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async editMessage(messageId: string, content: string) {
    return this.request(`/api/messages/${messageId}`, {
      method: 'PUT',
      body: { content },
    });
  }

  // AI endpoints
  async createAISession(data: { title?: string }) {
    return this.request('/api/ai/sessions', {
      method: 'POST',
      body: data,
    });
  }

  async getUserAISessions() {
    return this.request('/api/ai/sessions', {
      method: 'GET',
    });
  }

  async getSessionInteractions(sessionId: string) {
    return this.request(`/api/ai/sessions/${sessionId}`, {
      method: 'GET',
    });
  }

  async sendAIMessage(sessionId: string, data: { query: string; intent?: string }) {
    return this.request(`/api/ai/sessions/${sessionId}/message`, {
      method: 'POST',
      body: data,
    });
  }

  async enhanceMessage(message: string, action: string) {
    return this.request('/api/ai/enhance', {
      method: 'POST',
      body: { message, action },
    });
  }

  /**
   * Get or create the main AI agent session for the current user
   * This is a singleton session that persists across the app
   */
  async getMainAISession() {
    return this.request('/api/ai/session', {
      method: 'GET',
    });
  }

  /**
   * Get the conversation history for the main AI session
   * Returns all past interactions (queries and responses)
   */
  async getMainSessionHistory() {
    return this.request('/api/ai/session/history', {
      method: 'GET',
    });
  }

  /**
   * Send a message to the AI agent
   * @param sessionId - The AI session ID
   * @param query - The user's message/query
   */
  async chatWithAgent(sessionId: string, query: string) {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: { sessionId, query },
    });
  }
}

// Export singleton instance
export const api = new APIClient(API_URL);
export default api;