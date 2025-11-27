import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  // Chat room management
  joinChat(chatId: string) {
    this.socket?.emit('join-chat', chatId);
  }

  leaveChat(chatId: string) {
    this.socket?.emit('leave-chat', chatId);
  }

  // Send message
  sendMessage(data: {
    chatId: string;
    content: string;
    type?: 'text' | 'media' | 'system';
  }) {
    this.socket?.emit('send-message', data);
  }

  // Message events
  onNewMessage(callback: (message: any) => void) {
    this.socket?.on('new-message', callback);
  }

  onMessageUpdated(callback: (message: any) => void) {
    this.socket?.on('message-updated', callback);
  }

  onMessageDeleted(callback: (data: { messageId: string }) => void) {
    this.socket?.on('message-deleted', callback);
  }

  onUserTyping(callback: (data: { userId: string; username: string }) => void) {
    this.socket?.on('user-typing', callback);
  }

  onUserStoppedTyping(callback: (data: { userId: string }) => void) {
    this.socket?.on('user-stopped-typing', callback);
  }

  // Typing indicators
  startTyping(chatId: string) {
    this.socket?.emit('typing', chatId);
  }

  stopTyping(chatId: string) {
    this.socket?.emit('stop-typing', chatId);
  }

  // Remove event listeners
  offNewMessage(callback?: (message: any) => void) {
    this.socket?.off('new-message', callback);
  }

  offMessageUpdated(callback?: (message: any) => void) {
    this.socket?.off('message-updated', callback);
  }

  offMessageDeleted(callback?: (data: { messageId: string }) => void) {
    this.socket?.off('message-deleted', callback);
  }

  offUserTyping(callback?: (data: { userId: string; username: string }) => void) {
    this.socket?.off('user-typing', callback);
  }

  offUserStoppedTyping(callback?: (data: { userId: string }) => void) {
    this.socket?.off('user-stopped-typing', callback);
  }
}

// Export singleton instance
export const socketClient = new SocketClient();
export default socketClient;