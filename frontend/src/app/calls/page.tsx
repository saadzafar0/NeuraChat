// app/calls/page.tsx
'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface CallParticipant {
  userId: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface CallLog {
  id: string;
  chatId: string;
  initiatorId: string;
  type: 'audio' | 'video';
  status: 'active' | 'completed' | 'missed' | 'rejected';
  startTime: string;
  endTime: string | null;
  role: 'initiator' | 'receiver';
  chat: {
    id: string;
    name: string | null;
    type: 'private' | 'group';
  };
  participants: CallParticipant[];
  log: {
    id: string;
    quality_rating: number | null;
    duration_seconds: number | null;
    created_at: string;
  } | null;
}

export default function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallLogs = async () => {
      try {
        setLoading(true);
        const response = await api.getCallLogs(50, 0) as { calls: CallLog[]; total: number };
        setCalls(response.calls || []);
      } catch (err: any) {
        console.error('Failed to fetch call logs:', err);
        setError(err.message || 'Failed to load call history');
      } finally {
        setLoading(false);
      }
    };

    fetchCallLogs();
  }, []);

  // Format duration from seconds to mm:ss
  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get display name for a call
  const getCallDisplayName = (call: CallLog): string => {
    // For group chats, use the chat name
    if (call.chat?.type === 'group' && call.chat.name) {
      return call.chat.name;
    }
    // For private chats, use the other participant's name
    if (call.participants.length > 0) {
      const otherUser = call.participants[0].user;
      return otherUser.full_name || otherUser.username;
    }
    return 'Unknown';
  };

  // Get call type label
  const getCallTypeLabel = (call: CallLog): string => {
    if (call.status === 'missed') return 'Missed';
    if (call.status === 'rejected') return 'Declined';
    return call.role === 'initiator' ? 'Outgoing' : 'Incoming';
  };

  // Check if call was missed
  const isMissedCall = (call: CallLog): boolean => {
    return call.status === 'missed' || call.status === 'rejected';
  };

  // Get call icon based on type and status
  const getCallIcon = (call: CallLog) => {
    const missed = isMissedCall(call);
    const isVideo = call.type === 'video';
    const isOutgoing = call.role === 'initiator';

    if (missed) {
      return (
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      );
    }

    if (isVideo) {
      return (
        <svg className={`w-5 h-5 ${isOutgoing ? 'text-cyan-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    
    if (!isOutgoing) {
      return (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    }

    return (
      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
      </svg>
    );
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <Sidebar />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-6xl mx-auto p-8">
            {/* Header with Gradient */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Calls
                </span>
              </h1>
              <p className="text-gray-400">View your call history</p>
            </div>

            {/* Glass Card Container */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 overflow-hidden shadow-2xl">
              {/* Neon Border Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="divide-y divide-gray-700/50 relative z-10">
                {/* Loading State */}
                {loading && (
                  <div className="p-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-400">Loading call history...</p>
                  </div>
                )}

                {/* Error State */}
                {error && !loading && (
                  <div className="p-12 text-center">
                    <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400">{error}</p>
                  </div>
                )}

                {/* Empty State */}
                {!loading && !error && calls.length === 0 && (
                  <div className="p-12 text-center">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">No calls yet</h3>
                    <p className="text-gray-500">Your call history will appear here</p>
                  </div>
                )}

                {/* Call List */}
                {!loading && !error && calls.map((call) => {
                  const displayName = getCallDisplayName(call);
                  const typeLabel = getCallTypeLabel(call);
                  const missed = isMissedCall(call);
                  const duration = formatDuration(call.log?.duration_seconds);
                  const time = formatRelativeTime(call.startTime);
                  const avatarUrl = call.participants[0]?.user?.avatar_url;

                  return (
                    <div
                      key={call.id}
                      className="group p-5 hover:bg-gray-700/30 transition-all duration-300 flex items-center justify-between relative"
                    >
                      {/* Hover Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                      
                      <div className="flex items-center gap-4 relative z-10">
                        {/* Avatar with Gradient */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={displayName}
                              className="relative w-12 h-12 rounded-full object-cover shadow-lg"
                            />
                          ) : (
                            <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                              {getInitials(displayName)}
                            </div>
                          )}
                          {/* Call type indicator */}
                          {call.type === 'video' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                              <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-100 mb-1 group-hover:text-cyan-400 transition-colors">
                            {displayName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm">
                            {getCallIcon(call)}
                            <span className={missed ? 'text-red-400' : 'text-gray-400'}>
                              {typeLabel}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400">{duration}</span>
                            {call.chat?.type === 'group' && (
                              <>
                                <span className="text-gray-500">•</span>
                                <span className="text-purple-400 text-xs">Group</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right relative z-10">
                        <p className="text-sm text-gray-400 mb-2">{time}</p>
                        <button className="relative group/btn">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-0 group-hover/btn:opacity-75 transition-opacity"></div>
                          <div className="relative bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500 hover:to-blue-600 text-cyan-400 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 border border-cyan-500/30 hover:border-transparent text-sm">
                            {call.type === 'video' ? 'Video call' : 'Call back'}
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}