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
        throw {
          status: response.status,
          message: data.error || data.message || 'Request failed',
          data,
        };
      }

      return data as T;
    } catch (error: any) {
      // Network or parsing errors
      if (error.status) {
        throw error;
      }
      throw {
        status: 0,
        message: error.message || 'Network error',
        data: null,
      };
    }
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    username: string;
    full_name: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: data,
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me', {
      method: 'GET',
    });
  }

  // User endpoints
  async getUserProfile(userId: string) {
    return this.request(`/users/profile/${userId}`, {
      method: 'GET',
    });
  }

  async updateUserProfile(data: {
    username?: string;
    full_name?: string;
    avatar_url?: string | null;
    status_message?: string | null;
  }) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async searchUsers(query: string) {
    return this.request(`/users/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  async getUserContacts() {
    return this.request('/users/contacts', {
      method: 'GET',
    });
  }

  async updateLastSeen() {
    return this.request('/users/last-seen', {
      method: 'PUT',
    });
  }

  // Chat endpoints
  async createChat(data: {
    type: 'private' | 'group';
    name?: string;
    participants: string[];
  }) {
    return this.request('/chats', {
      method: 'POST',
      body: data,
    });
  }

  async getUserChats() {
    return this.request('/chats', {
      method: 'GET',
    });
  }

  async getChatDetails(chatId: string) {
    return this.request(`/chats/${chatId}`, {
      method: 'GET',
    });
  }

  async updateChat(chatId: string, data: { name: string }) {
    return this.request(`/chats/${chatId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async leaveChat(chatId: string) {
    return this.request(`/chats/${chatId}/leave`, {
      method: 'DELETE',
    });
  }

  // Message endpoints
  async getChatMessages(chatId: string, limit = 50, offset = 0) {
    return this.request(`/messages/${chatId}?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    });
  }

  async deleteMessage(messageId: string) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async editMessage(messageId: string, content: string) {
    return this.request(`/messages/${messageId}`, {
      method: 'PUT',
      body: { content },
    });
  }

  // AI endpoints
  async createAISession(data: { title?: string }) {
    return this.request('/ai/sessions', {
      method: 'POST',
      body: data,
    });
  }

  async getUserAISessions() {
    return this.request('/ai/sessions', {
      method: 'GET',
    });
  }

  async getSessionInteractions(sessionId: string) {
    return this.request(`/ai/sessions/${sessionId}`, {
      method: 'GET',
    });
  }

  async sendAIMessage(sessionId: string, data: { query: string; intent?: string }) {
    return this.request(`/ai/sessions/${sessionId}/message`, {
      method: 'POST',
      body: data,
    });
  }

  async enhanceMessage(message: string, action: string) {
    return this.request('/ai/enhance', {
      method: 'POST',
      body: { message, action },
    });
  }

  /**
   * Get or create the main AI agent session for the current user
   * This is a singleton session that persists across the app
   */
  async getMainAISession() {
    return this.request('/ai/session', {
      method: 'GET',
    });
  }

  /**
   * Get the conversation history for the main AI session
   * Returns all past interactions (queries and responses)
   */
  async getMainSessionHistory() {
    return this.request('/ai/session/history', {
      method: 'GET',
    });
  }

  /**
   * Send a message to the AI agent
   * @param sessionId - The AI session ID
   * @param query - The user's message/query
   */
  async chatWithAgent(sessionId: string, query: string) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: { sessionId, query },
    });
  }

  // ========== ENCRYPTION ENDPOINTS ==========

  /**
   * Upload user's encryption keys to the server
   */
  async uploadEncryptionKeys(data: {
    identityKey: string;
    signedPreKey: {
      id: number;
      public: string;
      signature: string;
    };
    oneTimePreKeys: Array<{ id: number; public: string }>;
  }) {
    return this.request('/encryption/keys', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Get a user's pre-key bundle for establishing encrypted session
   */
  async getPreKeyBundle(userId: string) {
    return this.request(`/encryption/keys/${userId}`, {
      method: 'GET',
    });
  }

  /**
   * Rotate signed pre-key
   */
  async rotateSignedPreKey(data: {
    signedPreKey: {
      id: number;
      public: string;
      signature: string;
    };
  }) {
    return this.request('/encryption/rotate-prekey', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Replenish one-time pre-keys
   */
  async replenishPreKeys(oneTimePreKeys: Array<{ id: number; public: string }>) {
    return this.request('/encryption/replenish-prekeys', {
      method: 'POST',
      body: { oneTimePreKeys },
    });
  }

  /**
   * Get encryption status
   */
  async getEncryptionStatus(): Promise<{
    hasKeys: boolean;
    prekeyCount: number;
    needsReplenishment: boolean;
  }> {
    return this.request('/encryption/status', {
      method: 'GET',
    });
  }

  /**
   * Initialize session with a contact
   */
  async initializeSession(contactId: string) {
    return this.request(`/encryption/session/${contactId}`, {
      method: 'POST',
    });
  }

  /**
   * Delete session with a contact
   */
  async deleteSession(contactId: string) {
    return this.request(`/encryption/session/${contactId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get active encryption sessions
   */
  async getActiveSessions() {
    return this.request('/encryption/sessions', {
      method: 'GET',
    });
  }
}

// Export singleton instance
export const api = new APIClient(API_URL);
export default api;