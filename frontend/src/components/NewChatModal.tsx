'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface User {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: () => void;
}

export default function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [chatType, setChatType] = useState<'private' | 'group'>('private');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
      setChatType('private');
      setGroupName('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const response: any = await api.searchUsers(searchQuery);
        const filteredUsers = response.users.filter((u: User) => u.id !== user?.id);
        setSearchResults(filteredUsers);
      } catch (err) {
        console.error('Search error:', err);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user?.id]);

  const toggleUserSelection = (selectedUser: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.find((u) => u.id === selectedUser.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== selectedUser.id);
      }
      return [...prev, selectedUser];
    });
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    if (chatType === 'group' && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (chatType === 'private' && selectedUsers.length > 1) {
      setError('Private chats can only have one other user');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.createChat({
        type: chatType,
        name: chatType === 'group' ? groupName : undefined,
        participants: selectedUsers.map((u) => u.id),
      });

      onChatCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create chat');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-md">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl"></div>
        
        {/* Modal */}
        <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 max-h-[85vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  New Chat
                </span>
              </h2>
              <button
                title="Close"
                onClick={onClose}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setChatType('private')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                  chatType === 'private'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Private
              </button>
              <button
                onClick={() => setChatType('group')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                  chatType === 'group'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Group
              </button>
            </div>

            {/* Group Name Input */}
            {chatType === 'group' && (
              <div className="mb-4 relative group">
                <input
                  type="text"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative group">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-500 group-focus-within:text-cyan-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-700/50">
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-3 py-1 shadow-lg shadow-cyan-500/20"
                  >
                    <span className="text-sm text-gray-200">{user.username}</span>
                    <button
                      title="Remove"
                      onClick={() => toggleUserSelection(user)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((searchUser) => {
                  const isSelected = selectedUsers.find((u) => u.id === searchUser.id);
                  return (
                    <button
                      key={searchUser.id}
                      onClick={() => toggleUserSelection(searchUser)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 shadow-lg shadow-cyan-500/20'
                          : 'hover:bg-gray-700/30 border border-transparent'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-lg">
                          {getInitials(searchUser.full_name || searchUser.username)}
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-100">{searchUser.full_name}</div>
                        <div className="text-sm text-gray-400">@{searchUser.username}</div>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : searchQuery.length >= 2 ? (
              <p className="text-center text-gray-400 py-8">No users found</p>
            ) : (
              <p className="text-center text-gray-400 py-8">Search for users to start a chat</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 pb-4">
              <div className="backdrop-blur-sm bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm shadow-lg shadow-red-500/20">
                {error}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-6 border-t border-gray-700/50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700/30 hover:bg-gray-700/50 text-gray-200 font-medium rounded-lg transition-all duration-300"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateChat}
              disabled={loading || selectedUsers.length === 0}
              className="relative flex-1 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium shadow-lg">
                {loading ? 'Creating...' : 'Create Chat'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}