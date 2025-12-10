'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  status_message?: string;
  last_seen: string;
  created_at: string;
}

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ userId, isOpen, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserProfile();
    }
  }, [isOpen, userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: any = await api.getUserProfile(userId);
      setProfile(response.user);
    } catch (err: any) {
      setError(err.message || 'Failed to load user profile');
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-600/20"></div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : profile ? (
          <div className="relative">
            {/* Profile Avatar */}
            <div className="flex flex-col items-center pt-12 pb-6 px-6">
              <div className="relative mb-4">
                <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-cyan-500/50">
                  {profile.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    (profile.full_name || profile.username).charAt(0).toUpperCase()
                  )}
                </div>
                {/* Online indicator (you can add online status logic here) */}
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-500 rounded-full border-4 border-gray-800 shadow-lg shadow-emerald-500/50"></div>
              </div>

              {/* Name and Username */}
              <h2 className="text-2xl font-bold text-white mb-1">
                {profile.full_name || profile.username}
              </h2>
              {profile.full_name && (
                <p className="text-gray-400 mb-2">@{profile.username}</p>
              )}
              {profile.status_message && (
                <p className="text-sm text-gray-300 text-center italic px-6 py-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
                  &ldquo;{profile.status_message}&rdquo;
                </p>
              )}
            </div>

            {/* Profile Details */}
            <div className="px-6 pb-6 space-y-4">
              {/* Email */}
              <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Email</p>
                    <p className="text-sm text-gray-200">{profile.email}</p>
                  </div>
                </div>
              </div>

              {/* Last Seen */}
              <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Last Seen</p>
                    <p className="text-sm text-gray-200">{formatLastSeen(profile.last_seen)}</p>
                  </div>
                </div>
              </div>

              {/* Member Since */}
              <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Member Since</p>
                    <p className="text-sm text-gray-200">{formatDate(profile.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Send Message
                </div>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
