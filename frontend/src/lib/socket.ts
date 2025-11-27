import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(token?: string) {
    if (this.socket) {
      this.disconnect();
    }

    // Connect to your backend URL
    this.socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'] // Important for fallback
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join user to their personal room
  joinUser(userId: string) {
    if (this.socket) {
      this.socket.emit('join', userId);
    }
  }

  // Join chat room
  joinChat(chatId: string) {
    if (this.socket) {
      this.socket.emit('join-chat', chatId);
    }
  }

  // Leave chat room
  leaveChat(chatId: string) {
    if (this.socket) {
      this.socket.emit('leave-chat', chatId);
    }
  }

  // Send message
  sendMessage(messageData: {
    chat_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'media' | 'system';
  }) {
    if (this.socket) {
      this.socket.emit('send-message', messageData);
    }
  }

  // Typing indicators
  startTyping(chatId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('typing', { chatId, userId });
    }
  }

  stopTyping(chatId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('stop-typing', { chatId, userId });
    }
  }

  // Event listeners
  onNewMessage(callback: (message: any) => void) {
    this.socket?.on('new-message', callback);
  }

  onMessageUpdated(callback: (message: any) => void) {
    this.socket?.on('message-updated', callback);
  }

  onMessageDeleted(callback: (data: { messageId: string }) => void) {
    this.socket?.on('message-deleted', callback);
  }

  onError(callback: (error: any) => void) {
    this.socket?.on('error', callback);
  }

  // Remove event listeners
  offNewMessage() {
    this.socket?.off('new-message');
  }

  offMessageUpdated() {
    this.socket?.off('message-updated');
  }

  offMessageDeleted() {
    this.socket?.off('message-deleted');
  }

  offError() {
    this.socket?.off('error');
  }

  getSocket() {
    return this.socket;
  }
}

const socketClient = new SocketClient();
export default socketClient;