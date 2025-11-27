'use client';

import { useState, useEffect, useRef } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import NewChatModal from '@/components/NewChatModal';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import socketClient from '@/lib/socket';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'media' | 'system';
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  users?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface Chat {
  id: string;
  type: 'private' | 'group';
  name?: string;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  participants: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar_url?: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user's chats
  const fetchChats = async () => {
    try {
      const response: any = await api.getUserChats();
      setChats(response.chats || []);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (chatId: string) => {
    try {
      const response: any = await api.getChatMessages(chatId);
      setMessages(response.messages || []);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Initialize: Fetch chats
  useEffect(() => {
    fetchChats();
  }, []);

  // Socket.IO: Connect and setup listeners
  useEffect(() => {
    if (!user) return;

    // Connect to socket (Note: Backend needs to handle JWT from cookies)
    socketClient.connect('');

    // Listen for new messages
    socketClient.onNewMessage((message: Message) => {
      if (selectedChat && message.chat_id === selectedChat.id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
      // Update last message in chat list
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === message.chat_id
            ? {
                ...chat,
                last_message: {
                  content: message.content,
                  created_at: message.created_at,
                  sender_id: message.sender_id,
                },
              }
            : chat
        )
      );
    });

    // Listen for message updates
    socketClient.onMessageUpdated((message: Message) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === message.id ? message : msg))
      );
    });

    // Listen for message deletions
    socketClient.onMessageDeleted(({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    return () => {
      socketClient.offNewMessage();
      socketClient.offMessageUpdated();
      socketClient.offMessageDeleted();
      socketClient.disconnect();
    };
  }, [user, selectedChat]);

  // When chat is selected, fetch messages and join room
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      socketClient.joinChat(selectedChat.id);
    }

    return () => {
      if (selectedChat) {
        socketClient.leaveChat(selectedChat.id);
      }
    };
  }, [selectedChat]);

  // Close message menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (messageMenuOpen) {
        setMessageMenuOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [messageMenuOpen]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || sendingMessage || !user) return;

    const content = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);

    try {
      // Send with correct field names matching backend
      socketClient.sendMessage({
        chat_id: selectedChat.id,
        sender_id: user.id,
        content,
        type: 'text',
      });
      socketClient.stopTyping(selectedChat.id, user.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageInput(content); // Restore message on error
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTyping = () => {
    if (!selectedChat || !user) return;

    socketClient.startTyping(selectedChat.id, user.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketClient.stopTyping(selectedChat.id, user.id);
    }, 3000);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setMessageMenuOpen(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const startEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setMessageMenuOpen(null);
  };

  const handleEditMessage = async () => {
    if (!editingMessageId || !editingContent.trim()) return;

    try {
      await api.editMessage(editingMessageId, editingContent.trim());
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId
            ? { ...msg, content: editingContent.trim() }
            : msg
        )
      );
      setEditingMessageId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
      alert('Failed to edit message');
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'group') {
      return chat.name || 'Unnamed Group';
    }
    // For private chats, show the other user's name
    const otherUser = chat.participants.find((p) => p.id !== user?.id);
    return otherUser?.full_name || otherUser?.username || 'Unknown User';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === 'group') {
      return getInitials(chat.name || 'Group');
    }
    const otherUser = chat.participants.find((p) => p.id !== user?.id);
    return getInitials(otherUser?.full_name || otherUser?.username || 'U');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const filteredChats = chats.filter((chat) => {
    const chatName = getChatName(chat).toLowerCase();
    return chatName.includes(searchQuery.toLowerCase());
  });

  return (
    <AuthGuard>
      <div className="flex h-screen bg-slate-900">
        <Sidebar />

        {/* Chat List */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-700">
            <h1 className="text-2xl font-bold text-slate-50 mb-4">Chats</h1>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors text-sm"
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner"></div>
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-4 border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {getChatAvatar(chat)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-slate-50 truncate">
                          {getChatName(chat)}
                        </h3>
                        {chat.last_message && (
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {formatTime(chat.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 truncate">
                        {chat.last_message?.content || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 px-4">
                <p className="text-slate-400">No chats yet</p>
                <p className="text-sm text-slate-500 mt-2">Click "New Chat" to start messaging</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedChat ? (
          <div className="flex-1 flex flex-col bg-slate-900">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {getChatAvatar(selectedChat)}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-slate-50">{getChatName(selectedChat)}</h2>
                  <p className="text-sm text-slate-400">
                    {selectedChat.participants.length} {selectedChat.participants.length === 1 ? 'participant' : 'participants'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === user?.id;
                const sender = message.users || selectedChat.participants.find((p) => p.id === message.sender_id);
                const isEditing = editingMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwnMessage && (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {getInitials(sender?.full_name || sender?.username || 'U')}
                        </div>
                      )}
                      <div className="relative group">
                        {!isOwnMessage && (
                          <div className="text-xs text-slate-400 mb-1 px-3">
                            {sender?.full_name || sender?.username}
                          </div>
                        )}
                        
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:border-blue-600 resize-none"
                              rows={3}
                              autoFocus
                              aria-label="Edit message"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleEditMessage}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            {/* Action button moved outside the message content box */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMessageMenuOpen(messageMenuOpen === message.id ? null : message.id);
                              }}
                              className={`absolute top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/20 rounded ${isOwnMessage ? '-left-8' : '-right-8'}`}
                              aria-label="message actions"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            <div
                              className={`px-4 py-2 rounded-lg ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-50'}`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-slate-400'}`}>
                                {formatMessageTime(message.created_at)}
                              </p>

                              {/* Dropdown Menu (unchanged position) */}
                              {messageMenuOpen === message.id && (
                                <div
                                  className={`absolute ${isOwnMessage ? 'left-0' : 'right-0'} top-8 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]`}
                                >
                                  {isOwnMessage && (
                                    <button
                                      onClick={() => startEditMessage(message)}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-700 bg-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-12 h-12 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-300 mb-2">
                Select a conversation to start messaging
              </h2>
              <p className="text-slate-500">
                Choose from your existing conversations or start a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onChatCreated={() => {
          fetchChats();
          setIsNewChatModalOpen(false);
        }}
      />
    </AuthGuard>
  );
}
