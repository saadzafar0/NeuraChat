import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private pendingOnConnect: Array<(socket: Socket) => void> = [];

  connect(token?: string) {
    if (this.socket) {
      this.disconnect();
    }

    // Connect to your backend URL
    this.socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000', {
      auth: {
        token: token || undefined
      },
      transports: ['websocket', 'polling'], // Important for fallback
      withCredentials: true, // Send cookies for authentication
      autoConnect: true,
      reconnection: true, // Enable automatic reconnection
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected to server, id:', this.socket?.id);
      this.isConnected = true;
      if (this.socket) {
        const callbacks = [...this.pendingOnConnect];
        this.pendingOnConnect = [];
        callbacks.forEach((cb) => cb(this.socket!));
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected from server, reason:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  onReady(callback: (socket: Socket) => void) {
    if (this.socket) {
      if (this.socket.connected) {
        callback(this.socket);
      } else {
        this.socket.once('connect', () => {
          if (this.socket) callback(this.socket);
        });
      }
      return;
    }
    this.pendingOnConnect.push(callback);
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

  // Call event listeners
  onIncomingCall(callback: (data: any) => void) {
    this.socket?.on('incoming-call', callback);
  }

  onCallAccepted(callback: (data: any) => void) {
    this.socket?.on('call-accepted', callback);
  }

  onCallRejected(callback: (data: any) => void) {
    this.socket?.on('call-rejected', callback);
  }

  onCallEnded(callback: (data: any) => void) {
    this.socket?.on('call-ended', callback);
  }

  // Call event emitters
  callInitiate(data: { chatId: string; toUserId: string; callId: string }) {
    if (this.socket) {
      this.socket.emit('call-initiate', data);
    }
  }

  callAccept(data: { chatId: string; channelName: string; callerId: string; callId: string }) {
    const socket = this.getSocket();
    
    if (!socket) {
      console.error('❌ Cannot emit call-accepted: socket not available');
      throw new Error('Socket not available');
    }

    if (!socket.connected) {
      console.warn('⚠️ Socket not connected, current state:', socket.disconnected ? 'disconnected' : 'connecting');
      // Try to connect if not already connecting
      if (socket.disconnected) {
        socket.connect();
      }
      // Wait for connection and retry
      socket.once('connect', () => {
        console.log('📤 Socket reconnected, emitting call-accepted:', data);
        socket.emit('call-accepted', data);
      });
      return;
    }

    console.log('📤 Emitting call-accepted:', data);
    socket.emit('call-accepted', data);
  }

  callReject(data: { callerId: string; callId: string }) {
    if (this.socket) {
      this.socket.emit('call-rejected', data);
    }
  }

  callEnd(data: { otherUserId: string; callId: string }) {
    if (this.socket) {
      this.socket.emit('call-ended', data);
    }
  }

  // Remove call event listeners
  offIncomingCall() {
    this.socket?.off('incoming-call');
  }

  offCallAccepted() {
    this.socket?.off('call-accepted');
  }

  offCallRejected() {
    this.socket?.off('call-rejected');
  }

  offCallEnded() {
    this.socket?.off('call-ended');
  }

  getSocket() {
    return this.socket;
  }
}

const socketClient = new SocketClient();
export default socketClient;