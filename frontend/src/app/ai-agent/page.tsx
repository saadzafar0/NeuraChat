'use client';

import { useState, useEffect, useRef } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

interface AIInteraction {
  id: string;
  session_id: string;
  user_query: string;
  ai_response: string;
  created_at: string;
}

interface AISession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function AIAgentPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<AISession | null>(null);
  const [history, setHistory] = useState<AIInteraction[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSession = async () => {
    try {
      const response = await api.getMainAISession() as { session: AISession };
      setSession(response.session);
      await fetchHistory();
    } catch (error) {
      console.error('Failed to fetch AI session:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.getMainSessionHistory() as { history: AIInteraction[] };
      setHistory(response.history || []);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !session || sendingMessage) return;

    const query = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);

    // Optimistically add user message
    const tempUserMessage: AIInteraction = {
      id: 'temp-' + Date.now(),
      session_id: session.id,
      user_query: query,
      ai_response: '',
      created_at: new Date().toISOString(),
    };
    setHistory((prev) => [...prev, tempUserMessage]);
    scrollToBottom();

    try {
      const response = await api.chatWithAgent(session.id, query) as { response: string };
      
      // Replace temp message with actual response
      setHistory((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          ai_response: response.response,
        };
        return updated;
      });
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setHistory((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id));
      setMessageInput(query);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
        {/* Background Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,217,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
        
        <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />

        {/* Mobile Header */}
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
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              AI Agent
            </span>
          </h1>
        </div>

        {/* AI Agent Chat Area */}
        <div className="flex-1 flex flex-col relative z-10 mt-16 lg:mt-0">
          {/* Header */}
          <div className="p-3 lg:p-4 border-b border-gray-700/50 backdrop-blur-xl bg-gray-800/30 relative">
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-100 flex items-center gap-2">
                  <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    NeuraChat AI Assistant
                  </span>
                </h2>
                <p className="text-sm text-gray-400">Your intelligent copilot</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading AI Assistant...</p>
                </div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative w-24 h-24 backdrop-blur-sm bg-gray-800/40 border border-gray-700/50 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold mb-3">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                      Welcome to NeuraChat AI Assistant
                    </span>
                  </h2>
                  <p className="text-gray-400 mb-4">
                    I'm your intelligent copilot, ready to help you with messaging, searching, managing chats, and much more.
                  </p>
                  <div className="text-left space-y-2 text-sm text-gray-500">
                    <p>💬 Send messages on your behalf</p>
                    <p>🔍 Search users and conversations</p>
                    <p>📊 Summarize chat history</p>
                    <p>🌐 Translate messages</p>
                    <p>⏰ Set reminders</p>
                  </div>
                </div>
              </div>
            ) : (
              history.map((interaction) => (
                <div key={interaction.id} className="space-y-4">
                  {/* User Message */}
                  {interaction.user_query && (
                    <div className="flex justify-end">
                      <div className="flex gap-2 max-w-[85%] sm:max-w-[70%] flex-row-reverse">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-lg shadow-cyan-500/30">
                          {user ? getInitials(user.full_name || user.username) : 'U'}
                        </div>
                        <div className="relative group">
                          <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                            <p className="whitespace-pre-wrap break-words">{interaction.user_query}</p>
                            <p className="text-xs mt-1 text-cyan-100">
                              {formatMessageTime(interaction.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Response */}
                  {interaction.ai_response && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 max-w-[85%] sm:max-w-[70%]">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-lg shadow-purple-500/30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="relative group">
                          <div className="text-xs text-purple-400 mb-1 px-3 font-medium">
                            AI Assistant
                          </div>
                          <div className="px-4 py-2 rounded-lg backdrop-blur-sm bg-gray-700/40 border border-gray-600/30 text-gray-100">
                            <p className="whitespace-pre-wrap break-words">{interaction.ai_response}</p>
                            <p className="text-xs mt-1 text-gray-400">
                              {formatMessageTime(interaction.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading indicator for AI response */}
                  {interaction.user_query && !interaction.ai_response && sendingMessage && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 max-w-[70%]">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-lg shadow-purple-500/30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="px-4 py-2 rounded-lg backdrop-blur-sm bg-gray-700/40 border border-gray-600/30">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-3 lg:p-4 border-t border-gray-700/50 backdrop-blur-xl bg-gray-800/30 relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMessage}
                  className="w-full px-3 lg:px-4 py-2 lg:py-3 text-sm lg:text-base bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendingMessage}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 hover:from-pink-500 hover:to-purple-600 px-4 lg:px-6 py-2 lg:py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm lg:text-base font-medium shadow-lg">
                  {sendingMessage ? (
                    <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="hidden sm:inline">Send</span>
                  )}
                  {!sendingMessage && (
                    <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}