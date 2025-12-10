'use client';

import { useState, useEffect, useRef } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import NewChatModal from '@/components/NewChatModal';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import socketClient from '@/lib/socket';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import AIMessageAssistant from '@/components/AIMessageAssistant';
import { IncomingCallModal } from '@/components/incoming-call-modal';
import { InCallUI } from '@/components/in-call-ui';
import { useCall } from '@/hooks/useCall';
import { OutgoingCallUI } from '@/components/outgoing-call-ui';
import { useRouter } from 'next/navigation';
import FileUploadModal from '@/components/FileUploadModal';

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

interface Notification {
  id: string;
  user_id: string;
  type: 'message' | 'call' | 'system' | 'ai_summary';
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  chat_id?: string;
  chats?: {
    id: string;
    type: string;
    name?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinedChatsRef = useRef<Set<string>>(new Set());
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);

  // Call functionality
  const { callState, currentCall, isMuted, isSpeakerMuted, callStartedAt, initiateCall, acceptCall, rejectCall, endCall, toggleMute, toggleSpeaker, resetCallSession } = useCall();

  const handleApplyAIEnhancement = (enhancedMessage: string) => {
    setMessageInput(enhancedMessage);
    setIsAIAssistantOpen(false);
  };

  // NOTIFICATION FUNCTIONS
  const fetchNotifications = async () => {
    try {
      const response = await api.getNotifications() as { notifications: Notification[] };
      const unreadNotifs = (response.notifications || []).filter((n: Notification) => !n.is_read);
      setNotifications(unreadNotifs);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const getUnreadCountForChat = (chatId: string) => {
    return notifications.filter((n) => n.chat_id === chatId && n.chat_id !== null).length;
  };

  const getTotalUnreadCount = () => {
    return notifications.length;
  };

  const markChatNotificationsAsRead = async (chatId: string) => {
    const chatNotifications = notifications.filter((n) => n.chat_id === chatId && n.chat_id !== null);

    if (chatNotifications.length === 0) return; // No notifications to mark

    for (const notification of chatNotifications) {
      try {
        await api.markNotificationRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    setNotifications((prev) => prev.filter((n) => n.chat_id !== chatId));
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications([]);
      setIsNotificationPanelOpen(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const fetchChats = async () => {
    try {
      const response: any = await api.getUserChats();
      const fetchedChats: Chat[] = response?.chats || [];
      setChats(fetchedChats);

      // Proactively join all chat rooms so incoming messages arrive even when not open
      socketClient.onReady((sock) => {
        fetchedChats.forEach((chat) => {
          if (!joinedChatsRef.current.has(chat.id)) {
            socketClient.joinChat(chat.id);
            joinedChatsRef.current.add(chat.id);
          }
        });
      });
    } catch (error: any) {
      const friendlyMessage = error?.message || 'Unknown error fetching chats';
      const status = error?.status ?? 'n/a';
      console.error(`Failed to fetch chats [status=${status}]:`, error);
      alert(`Could not load chats (status: ${status}). ${friendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const response: any = await api.getChatMessages(chatId);
      setMessages(response.messages || []);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!user) return;

    const cleanupFns: Array<() => void> = [];

    const attachHandlers = (socketInstance: any) => {
      const dashboardIncomingCallHandler = (data: any) => {
        console.log('🎯 Dashboard received incoming-call event (debug only):', data);
        console.log('🎯 Current callState from useCall:', callState);
        console.log('🎯 Current currentCall from useCall:', currentCall);
      };
      socketInstance.on('incoming-call', dashboardIncomingCallHandler);

      // Listen for real-time notifications (Observer pattern)
      const notificationHandler = (notification: Notification) => {
        console.log('🔔 New notification received:', notification);
        if (!notification.is_read) {
          setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === notification.id)) return prev;
            return [notification, ...prev];
          });
        }
      };
      socketInstance.on('notification:new', notificationHandler);

      // Listen for chat updates (Observer pattern for sidebar)
      const chatUpdatedHandler = (data: { chatId: string; lastMessage: any }) => {
        console.log('💬 Chat updated:', data);
        setChats((prev) => {
          const updated = prev.map((chat) =>
            chat.id === data.chatId
              ? { ...chat, last_message: data.lastMessage }
              : chat
          );
          // Re-sort: chats with more recent messages first
          return updated.sort((a, b) => {
            const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
            const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
            return bTime - aTime;
          });
        });
      };
      socketInstance.on('chat:updated', chatUpdatedHandler);

      socketClient.onNewMessage((message: Message) => {
        if (selectedChat && message.chat_id === selectedChat.id) {
          setMessages((prev) => [...prev, message]);
          scrollToBottom();
        }
        // Also update chat list with last message
        setChats((prev) => {
          const updated = prev.map((chat) =>
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
          );
          // Re-sort: chats with more recent messages first
          return updated.sort((a, b) => {
            const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
            const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
            return bTime - aTime;
          });
        });
      });

      socketClient.onMessageUpdated((message: Message) => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === message.id ? message : msg))
        );
      });

      socketClient.onMessageDeleted(({ messageId }) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      });

      return () => {
        socketInstance.off('incoming-call', dashboardIncomingCallHandler);
        socketInstance.off('notification:new', notificationHandler);
        socketInstance.off('chat:updated', chatUpdatedHandler);
        socketClient.offNewMessage();
        socketClient.offMessageUpdated();
        socketClient.offMessageDeleted();
      };
    };

    socketClient.onReady((sock) => {
      const cleanup = attachHandlers(sock);
      cleanupFns.push(cleanup);
    });

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [user, selectedChat, callState, currentCall]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      socketClient.joinChat(selectedChat.id);
      markChatNotificationsAsRead(selectedChat.id);
    }

    return () => {
      if (selectedChat) {
        socketClient.leaveChat(selectedChat.id);
      }
    };
  }, [selectedChat]);

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
      socketClient.sendMessage({
        chat_id: selectedChat.id,
        sender_id: user.id,
        content,
        type: 'text',
      });
      socketClient.stopTyping(selectedChat.id, user.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageInput(content);
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

  const handleDeleteMessage = (messageId: string) => {
    setMessageToDelete(messageId);
    setIsDeleteModalOpen(true);
    setMessageMenuOpen(null);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    try {
      await api.deleteMessage(messageToDelete);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    } finally {
      setMessageToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };
  
  const closeDeleteModal = () => {
    setMessageToDelete(null);
    setIsDeleteModalOpen(false);
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

  // Sort chats: unread first, then by last message time (WhatsApp-like)
  const filteredChats = chats
    .filter((chat) => {
      const chatName = getChatName(chat).toLowerCase();
      return chatName.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aUnread = getUnreadCountForChat(a.id);
      const bUnread = getUnreadCountForChat(b.id);
      
      // Unread chats come first
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;
      
      // Then sort by last message time (most recent first)
      const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
        {/* Background Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,217,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
        
        <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />

        {/* Mobile Header with Menu Toggle */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 backdrop-blur-xl bg-gray-800/30 border-b border-gray-700/50 p-4 flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              NeuraChat
            </span>
          </h1>
          {selectedChat && (
            <button
              onClick={() => setSelectedChat(null)}
              className="ml-auto text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Back to chats"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
        </div>

        {/* NOTIFICATION BUBBLE - TOP LEFT (Mobile & Desktop) */}
        <div className="fixed top-6 left-6 z-50 lg:left-80">
          <button
            onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
            className="relative group"
          >
            {/* Glow Effect */}
            <div className={`absolute inset-0 rounded-full blur-lg transition-opacity ${
              getTotalUnreadCount() > 0 
                ? 'bg-gradient-to-br from-pink-500 to-purple-600 opacity-60 group-hover:opacity-80' 
                : 'bg-gray-600 opacity-30'
            }`}></div>
            
            {/* Button */}
            <div className={`relative w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center transition-all shadow-2xl ${
              getTotalUnreadCount() > 0
                ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}>
              <svg className={`w-6 h-6 lg:w-7 lg:h-7 ${getTotalUnreadCount() > 0 ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              
              {/* Badge */}
              {getTotalUnreadCount() > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 lg:w-6 lg:h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-bounce">
                  {getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount()}
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Chat List */}
        <div className={`
          ${selectedChat ? 'hidden lg:flex' : 'flex'}
          w-full lg:w-80 backdrop-blur-xl bg-gray-800/30 border-r border-gray-700/50 flex-col relative z-10
          ${selectedChat ? '' : 'mt-16 lg:mt-0'}
        `}>
          {/* Header with Gradient */}
          <div className="p-4 lg:p-6 border-b border-gray-700/50 relative">
            {/* Glow Effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            
            <h1 className="text-xl lg:text-2xl font-bold mb-4 hidden lg:block">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Chats
              </span>
            </h1>

            {/* Search with Glow */}
            <div className="relative mb-4 group">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm"
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors"
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
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
            </div>

            {/* New Chat Button with Gradient */}
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="relative w-full group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </div>
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner"></div>
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => {
                const unreadCount = getUnreadCountForChat(chat.id);
                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChat(chat);
                      // Mark notifications as read when selecting a chat
                      if (unreadCount > 0) {
                        markChatNotificationsAsRead(chat.id);
                      }
                    }}
                    className={`p-4 border-b border-gray-700/30 cursor-pointer transition-all duration-300 relative group ${
                      selectedChat?.id === chat.id 
                        ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-l-2 border-l-cyan-500' 
                        : 'hover:bg-gray-700/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-lg shadow-cyan-500/30">
                          {getChatAvatar(chat)}
                        </div>
                        {selectedChat?.id === chat.id && (
                          <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-pulse"></div>
                        )}
                        {/* Online indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900"></div>
                      </div>
                      
                      {/* Chat Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`font-semibold truncate ${
                            unreadCount > 0 ? 'text-white' : 'text-gray-100'
                          }`}>
                            {getChatName(chat)}
                          </h3>
                          {/* Time + Badge container (right side like WhatsApp) */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                            {chat.last_message && (
                              <span className={`text-xs ${
                                unreadCount > 0 ? 'text-cyan-400' : 'text-gray-500'
                              }`}>
                                {formatTime(chat.last_message.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate flex-1 ${
                            unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-400'
                          }`}>
                            {chat.last_message?.content || 'No messages yet'}
                          </p>
                          {/* Unread badge on the right (WhatsApp style) */}
                          {unreadCount > 0 && (
                            <div className="ml-2 min-w-5 h-5 px-1.5 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/50">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 px-4">
                <p className="text-gray-400">No chats yet</p>
                <p className="text-sm text-gray-500 mt-2">Click "New Chat" to start messaging</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedChat ? (
          <div className="flex-1 flex flex-col relative z-10 mt-16 lg:mt-0">
            {/* Chat Header with Gradient Border */}
            <div className="p-3 lg:p-4 border-b border-gray-700/50 backdrop-blur-xl bg-gray-800/30 relative">
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg shadow-cyan-500/30">
                    {getChatAvatar(selectedChat)}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900 shadow-lg shadow-emerald-500/50"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-100">{getChatName(selectedChat)}</h2>
                    {callState === 'in-call' && (
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                        In Call
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {selectedChat.participants.length} {selectedChat.participants.length === 1 ? 'participant' : 'participants'}
                  </p>
                </div>
                {/* Call button - only show for private chats with 2 participants */}
                {selectedChat.type === 'private' && selectedChat.participants.length === 2 && (
                  <button
                    onClick={() => {
                      const otherUser = selectedChat.participants.find((p) => p.id !== user?.id);
                      if (otherUser) {
                        const otherUserName =
                          otherUser.full_name || otherUser.username || selectedChat.name || 'Unknown';
                        initiateCall(selectedChat.id, otherUser.id, otherUserName);
                      }
                    }}
                    disabled={callState !== 'idle'}
                    className={`relative group ${
                      callState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Start audio call"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 p-2 rounded-lg transition-all duration-300 text-white shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                  </button>
                )}
                {/* End call button - show when in call */}
                {callState === 'in-call' && (
                  <button
                    onClick={endCall}
                    className="relative group"
                    title="End call"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative bg-gradient-to-r from-red-500 to-pink-600 hover:from-pink-500 hover:to-red-600 p-2 rounded-lg transition-all duration-300 text-white shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === user?.id;
                const sender = message.users || selectedChat.participants.find((p) => p.id === message.sender_id);
                const isEditing = editingMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] sm:max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwnMessage && (
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-lg shadow-cyan-500/30">
                          {getInitials(sender?.full_name || sender?.username || 'U')}
                        </div>
                      )}
                      <div className="relative group">
                        {!isOwnMessage && (
                          <div className="text-xs text-cyan-400 mb-1 px-3 font-medium">
                            {sender?.full_name || sender?.username}
                          </div>
                        )}
                        
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-cyan-500 resize-none"
                              rows={3}
                              autoFocus
                              aria-label="Edit message"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleEditMessage}
                                className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 text-white text-sm rounded-lg transition-all duration-300 shadow-lg"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-700/50 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            {/* Action button */}
                            {isOwnMessage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMessageMenuOpen(messageMenuOpen === message.id ? null : message.id);
                                }}
                                className="absolute top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/30 rounded-lg -left-8"
                                aria-label="message actions"
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                            )}

                            {/* Message Bubble */}
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                isOwnMessage
                                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                                  : 'backdrop-blur-sm bg-gray-700/40 border border-gray-600/30 text-gray-100'
                              }`}
                            >
                              {/* Render based on message type */}
                              {message.type === 'media' ? (
                                <div className="space-y-2">
                                  {/* Check if it's an image */}
                                  {message.content.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                    <img
                                      src={message.content}
                                      alt="Shared image"
                                      className="max-w-full max-h-96 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(message.content, '_blank')}
                                    />
                                  ) : message.content.match(/\.(mp4|webm|ogg)$/i) ? (
                                    /* Video */
                                    <video
                                      controls
                                      className="max-w-full max-h-96 rounded-lg"
                                      src={message.content}
                                    />
                                  ) : message.content.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
                                    /* Audio */
                                    <audio
                                      controls
                                      className="w-full"
                                      src={message.content}
                                    />
                                  ) : (
                                    /* Other file types - show download link */
                                    <a
                                      href={message.content}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                    >
                                      <div className="w-10 h-10 bg-gray-600/50 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {message.content.split('/').pop()?.split('?')[0] || 'Download File'}
                                        </p>
                                        <p className="text-xs opacity-75">Click to download</p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                /* Regular text message */
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              )}
                              <p className={`text-xs mt-1 ${isOwnMessage ? 'text-cyan-100' : 'text-gray-400'}`}>
                                {formatMessageTime(message.created_at)}
                              </p>

                              {/* Dropdown Menu */}
                              {messageMenuOpen === message.id && (
                                <div
                                  className={`absolute ${isOwnMessage ? 'left-0' : 'right-0'} top-full mt-1 backdrop-blur-xl bg-gray-800/90 border border-gray-700/50 rounded-lg shadow-2xl py-1 z-20 min-w-[120px]`}
                                >
                                  {/* Only allow editing text messages */}
                                  {isOwnMessage && message.type === 'text' && (
                                    <button
                                      onClick={() => startEditMessage(message)}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
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

            {/* Message Input with Glow */}
            <div className="p-3 lg:p-4 border-t border-gray-700/50 backdrop-blur-xl bg-gray-800/30 relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative group">
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
                    className="w-full px-3 lg:px-4 py-2 lg:py-3 text-sm lg:text-base bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                </div>

                {/* File Upload Button */}
                <button
                  onClick={() => setIsFileUploadOpen(true)}
                  className="relative group"
                  title="Share File"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative px-3 lg:px-4 py-2 lg:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-500 hover:to-blue-600 text-white rounded-lg transition-all duration-300 shadow-lg">
                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                </button>

                {/* AI Assistant Button */}
                <button
                  onClick={() => setIsAIAssistantOpen(true)}
                  disabled={!messageInput.trim()}
                  className="relative group"
                  title="AI Message Assistant"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg blur transition-opacity ${
                    messageInput.trim() ? 'opacity-75 group-hover:opacity-100' : 'opacity-30'
                  }`}></div>
                  <div className={`relative px-3 lg:px-4 py-2 lg:py-3 rounded-lg transition-all duration-300 shadow-lg ${
                    messageInput.trim()
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-pink-500 hover:to-purple-600 text-white'
                      : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }`}>
                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </button>

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 px-4 lg:px-6 py-2 lg:py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm lg:text-base font-medium shadow-lg">
                    <span className="hidden sm:inline">Send</span>
                    <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center relative z-10">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full blur-lg opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 backdrop-blur-sm bg-gray-800/40 border border-gray-700/50 rounded-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-cyan-400"
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
              </div>
              <h2 className="text-xl font-semibold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Select a conversation to start messaging
                </span>
              </h2>
              <p className="text-gray-500">
                Choose from your existing conversations or start a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this message? This action cannot be undone."
      />

      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onChatCreated={() => {
          fetchChats();
          setIsNewChatModalOpen(false);
        }}
      />

      {/* AI Message Assistant Modal */}
      <AIMessageAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        originalMessage={messageInput}
        onApply={handleApplyAIEnhancement}
      />

      {/* NOTIFICATION PANEL */}
      {isNotificationPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsNotificationPanelOpen(false)}
        >
          <div 
            className="fixed top-24 left-6 lg:left-80 w-80 sm:w-96 max-h-[600px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl blur-xl opacity-30"></div>
            
            {/* Panel */}
            <div className="relative backdrop-blur-xl bg-gray-800/95 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent"></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <h3 className="font-semibold bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
                      Notifications ({getTotalUnreadCount()})
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsNotificationPanelOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700/50 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[450px]">
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-400 font-medium">All caught up!</p>
                    <p className="text-sm text-gray-500 mt-1">No unread notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const chatId = notification.chat_id || '';
                    const chat = chats.find((c) => c.id === chatId);
                    const chatName = chat ? getChatName(chat) : 'Unknown Chat';

                    return (
                      <div
                        key={notification.id}
                        className="backdrop-blur-sm bg-gray-700/40 hover:bg-gray-700/60 border border-gray-600/30 rounded-lg p-3 transition-all group cursor-pointer"
                        onClick={() => {
                          if (chatId) {
                            const chat = chats.find((c) => c.id === chatId);
                            if (chat) {
                              setSelectedChat(chat);
                              setIsNotificationPanelOpen(false);
                              handleMarkNotificationRead(notification.id);
                            }
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon based on notification type */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            notification.type === 'message' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : notification.type === 'call'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {notification.type === 'message' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                              </svg>
                            ) : notification.type === 'call' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-pink-400 text-sm truncate">
                                    {notification.title}
                                  </p>
                                  {(!chatId || chatId === null) && (
                                    <span className="text-xs text-gray-500 italic flex-shrink-0">(Legacy)</span>
                                  )}
                                </div>
                                {chatName && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {chatName}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkNotificationRead(notification.id);
                                }}
                                className="flex-shrink-0 text-gray-400 hover:text-cyan-400 transition-colors p-1 hover:bg-gray-600/50 rounded"
                                title="Mark as read"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* Message preview */}
                            <p className="text-sm text-gray-300 mb-1 line-clamp-2">
                              {notification.content}
                            </p>

                            {/* Timestamp */}
                            <p className="text-xs text-gray-500">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-700/50 flex-shrink-0">
                  <button
                    onClick={handleMarkAllRead}
                    className="w-full py-2 bg-gradient-to-r from-pink-500/20 to-purple-600/20 hover:from-pink-500/30 hover:to-purple-600/30 border border-pink-500/50 text-pink-400 rounded-lg transition-all font-medium text-sm"
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {callState === 'ringing' && currentCall && (
        <>
          {console.log('🎯 Rendering IncomingCallModal, callState:', callState, 'currentCall:', currentCall)}
          <IncomingCallModal
            isOpen={true}
            callerName={
              (() => {
                // Try to find caller name from selectedChat first
                if (selectedChat?.participants) {
                  const caller = selectedChat.participants.find((p) => p.id === currentCall.fromUserId);
                  if (caller) {
                    return caller.full_name || caller.username || 'Unknown';
                  }
                }
                // If not found, try to find from all chats
                const chatWithCaller = chats.find((chat) => 
                  chat.id === currentCall.chatId && 
                  chat.participants.some((p) => p.id === currentCall.fromUserId)
                );
                if (chatWithCaller) {
                  const caller = chatWithCaller.participants.find((p) => p.id === currentCall.fromUserId);
                  return caller?.full_name || caller?.username || 'Unknown';
                }
                return 'Unknown Caller';
              })()
            }
            onAccept={acceptCall}
            onReject={rejectCall}
            isProcessing={false}
          />
        </>
      )}

      {/* In-Call UI */}
      {callState === 'in-call' && currentCall && (
        <InCallUI
          isOpen={true}
          otherUserName={
            (() => {
              // Find the other user's name
              const chatWithOtherUser = chats.find((chat) => chat.id === currentCall.chatId);
              if (chatWithOtherUser?.participants) {
                const otherUser = chatWithOtherUser.participants.find(
                  (p) => p.id !== user?.id
                );
                if (otherUser) {
                  return otherUser.full_name || otherUser.username || 'Unknown';
                }
              }
              return 'Unknown User';
            })()
          }
          isMuted={isMuted}
          isSpeakerMuted={isSpeakerMuted}
          callStartedAt={callStartedAt}
          audioTrack={currentCall.audioTrack}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onEndCall={endCall}
        />
      )}

      {/* Outgoing call UI */}
      {callState === 'calling' && currentCall?.isCaller && (
        <OutgoingCallUI
          otherUserName={
            (() => {
              const chatWithOtherUser = chats.find((chat) => chat.id === currentCall.chatId);
              if (chatWithOtherUser?.participants) {
                const otherUser = chatWithOtherUser.participants.find((p) => p.id !== user?.id);
                if (otherUser) {
                  return otherUser.full_name || otherUser.username || 'Unknown';
                }
              }
              return 'Unknown User';
            })()
          }
          status="calling"
          onCancel={endCall}
          onReturnToChat={() => {
            resetCallSession();
          }}
          onReturnToDashboard={() => {
            resetCallSession();
            router.push('/dashboard');
          }}
        />
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        chatId={selectedChat?.id || ''}
        onFileUploaded={() => {
          if (selectedChat) {
            fetchMessages(selectedChat.id);
          }
        }}
      />
    </AuthGuard>
  );
}