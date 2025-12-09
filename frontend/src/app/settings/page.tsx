'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import EditProfileModal from '@/components/EditProfileModal';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Local state to reflect updates immediately
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.full_name || '');
      setUsername(user.username || '');
      setStatusMessage(user.status_message || '');
    }
  }, [user]);

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

  const handleProfileUpdated = (updated: { full_name: string; username: string; status_message: string }) => {
    setDisplayName(updated.full_name);
    setUsername(updated.username);
    setStatusMessage(updated.status_message);
    setIsEditProfileOpen(false);
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
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto relative z-10 mt-16 lg:mt-0">
          <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Header with Gradient */}
            <div className="mb-6 lg:mb-8">
              <h1 className="text-2xl lg:text-4xl font-bold mb-2 hidden lg:block">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Settings
                </span>
              </h1>
              <p className="text-gray-400 text-sm lg:text-base hidden lg:block">Manage your account and preferences</p>
            </div>

            {/* Profile Section - Glass Card */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 p-6 mb-6 shadow-2xl group">
              {/* Neon Border Effect on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-100">Profile</h2>
                  <button
                    onClick={() => setIsEditProfileOpen(true)}
                    className="relative group/btn"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-50 group-hover/btn:opacity-75 transition-opacity"></div>
                    <div className="relative px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500 hover:to-blue-600 text-cyan-400 hover:text-white font-medium rounded-lg transition-all duration-300 border border-cyan-500/30 hover:border-transparent text-sm">
                      Edit Profile
                    </div>
                  </button>
                </div>

                {/* Avatar Upload with Gradient Glow */}
                <div className="flex items-center gap-6 mb-6">
                  <div className="relative group/avatar cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full blur opacity-50 group-hover/avatar:opacity-75 transition-opacity"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      {getInitials(displayName || username)}
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
                      value={displayName}
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
                      value={username}
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
                      value={statusMessage}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                    />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none"></div>
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
                  <button 
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="w-full text-left px-4 py-3 bg-gray-700/30 hover:bg-gray-700/50 backdrop-blur-sm rounded-lg text-gray-200 transition-all duration-300 border border-gray-600/30 hover:border-cyan-500/50 group/btn"
                  >
                    <span className="group-hover/btn:text-cyan-400 transition-colors">Change Password</span>
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

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentValues={{
          full_name: displayName,
          username: username,
          status_message: statusMessage,
        }}
        onSave={handleProfileUpdated}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </AuthGuard>
  );
}