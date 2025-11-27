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
      <div className="flex h-screen bg-slate-900">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-50 mb-2">Settings</h1>
              <p className="text-slate-400">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-6">Profile</h2>

              {/* Avatar Upload */}
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl relative group cursor-pointer">
                  {user && getInitials(user.full_name || user.username)}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                <div>
                  <p className="text-slate-300 mb-1">Click the icon to upload a new profile picture</p>
                  <p className="text-sm text-slate-500">Maximum file size: 5MB</p>
                </div>
              </div>

              {/* Display Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={user?.full_name || ''}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>

              {/* Username */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={user?.username || ''}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Email address cannot be changed</p>
              </div>

              {/* Status Message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Status Message
                </label>
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  value={user?.status_message || ''}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            {/* AI Settings Section */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">AI Settings</h2>
              <p className="text-slate-400 mb-4">Configure AI-powered features</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-700">
                  <div>
                    <h3 className="text-slate-200 font-medium">Smart Reply</h3>
                    <p className="text-sm text-slate-400">Enable AI-generated quick replies</p>
                  </div>
                  <button className="w-12 h-6 bg-blue-600 rounded-full relative transition-colors">
                    <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-700">
                  <div>
                    <h3 className="text-slate-200 font-medium">Message Summarization</h3>
                    <p className="text-sm text-slate-400">Summarize long conversations</p>
                  </div>
                  <button className="w-12 h-6 bg-slate-700 rounded-full relative transition-colors">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h3 className="text-slate-200 font-medium">Voice Assistant</h3>
                    <p className="text-sm text-slate-400">Enable voice commands</p>
                  </div>
                  <button className="w-12 h-6 bg-slate-700 rounded-full relative transition-colors">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">Account</h2>
              
              <div className="space-y-3">
                <button className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors">
                  Change Password
                </button>
                
                <button className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors">
                  Privacy Settings
                </button>
                
                <button className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors">
                  Notification Preferences
                </button>

                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 bg-red-900/20 hover:bg-red-900/30 border border-red-600/50 rounded-lg text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="mt-6 text-center text-sm text-slate-500">
              <p>Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}