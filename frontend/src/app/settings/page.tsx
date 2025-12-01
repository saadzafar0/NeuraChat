// app/settings/page.tsx
'use client';

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
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
          <div className="max-w-4xl mx-auto p-8">
            {/* Header with Gradient */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Settings
                </span>
              </h1>
              <p className="text-gray-400">Manage your account and preferences</p>
            </div>

            {/* Profile Section - Glass Card */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 p-6 mb-6 shadow-2xl group">
              {/* Neon Border Effect on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-100 mb-6">Profile</h2>

                {/* Avatar Upload with Gradient Glow */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="relative group/avatar cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full blur opacity-50 group-hover/avatar:opacity-75 transition-opacity"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      {user && getInitials(user.full_name || user.username)}
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                        <svg
                          className="w-8 h-8 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-300 mb-1">Click the icon to upload a new profile picture</p>
                    <p className="text-sm text-gray-500">Maximum file size: 5MB</p>
                  </div>
                </div>

                {/* Display Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Display Name
                  </label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      value={user?.full_name || ''}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      aria-label="Display Name"
                    />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                </div>

                {/* Username */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      value={user?.username || ''}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      aria-label="Username"
                    />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-gray-900/30 backdrop-blur-sm border border-gray-700/50 rounded-lg text-gray-500 cursor-not-allowed"
                    aria-label="Email Address"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>
                </div>

                {/* Status Message */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status Message
                  </label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      placeholder="What's on your mind?"
                      value={user?.status_message || ''}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                    />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Settings Section - Glass Card */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 p-6 mb-6 shadow-2xl group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-100 mb-4">AI Settings</h2>
                <p className="text-gray-400 mb-4">Configure AI-powered features</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                    <div>
                      <h3 className="text-gray-200 font-medium">Smart Reply</h3>
                      <p className="text-sm text-gray-400">Enable AI-generated quick replies</p>
                    </div>
                    <button type="button" title="Toggle Smart Reply" className="relative w-12 h-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/30">
                      <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md"></span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                    <div>
                      <h3 className="text-gray-200 font-medium">Message Summarization</h3>
                      <p className="text-sm text-gray-400">Summarize long conversations</p>
                    </div>
                    <button title='Message Summarization' className="relative w-12 h-6 bg-gray-700/50 rounded-full transition-all duration-300 hover:bg-gray-600/50">
                      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md"></span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h3 className="text-gray-200 font-medium">Voice Assistant</h3>
                      <p className="text-sm text-gray-400">Enable voice commands</p>
                    </div>
                    <button title="Voice Assistant" className="relative w-12 h-6 bg-gray-700/50 rounded-full transition-all duration-300 hover:bg-gray-600/50">
                      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Actions - Glass Card */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 p-6 shadow-2xl group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Account</h2>
                
                <div className="space-y-3">
                  <button className="w-full text-left px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 backdrop-blur-sm rounded-lg text-gray-200 transition-all duration-300 border border-gray-600/30 hover:border-cyan-500/50 group/btn">
                    <span className="group-hover/btn:text-cyan-400 transition-colors">Change Password</span>
                  </button>
                  
                  <button className="w-full text-left px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 backdrop-blur-sm rounded-lg text-gray-200 transition-all duration-300 border border-gray-600/30 hover:border-cyan-500/50 group/btn">
                    <span className="group-hover/btn:text-cyan-400 transition-colors">Privacy Settings</span>
                  </button>
                  
                  <button className="w-full text-left px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 backdrop-blur-sm rounded-lg text-gray-200 transition-all duration-300 border border-gray-600/30 hover:border-cyan-500/50 group/btn">
                    <span className="group-hover/btn:text-cyan-400 transition-colors">Notification Preferences</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="relative w-full group/logout"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg blur opacity-50 group-hover/logout:opacity-75 transition-opacity"></div>
                    <div className="relative w-full text-left px-4 py-3 bg-red-900/20 hover:bg-red-900/30 backdrop-blur-sm border border-red-600/50 rounded-lg text-red-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                      {loading ? 'Logging out...' : 'Logout'}
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Account Info with Gradient Text */}
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>Account created: <span className="text-cyan-400">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span></p>
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