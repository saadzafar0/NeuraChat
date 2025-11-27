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
      // Reset state when modal closes
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
        // Filter out current user
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-50">New Chat</h2>
            <button
              title='New Chat'
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
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
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                chatType === 'private'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Private
            </button>
            <button
              onClick={() => setChatType('group')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                chatType === 'group'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Group
            </button>
          </div>

          {/* Group Name Input */}
          {chatType === 'group' && (
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 mb-4 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
            />
          )}

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-slate-500"
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
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-700">
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 bg-blue-600/20 border border-blue-600/50 rounded-lg px-3 py-1"
                >
                  <span className="text-sm text-slate-200">{user.username}</span>
                  <button
                    title='Username'
                    onClick={() => toggleUserSelection(user)}
                    className="text-slate-400 hover:text-slate-200"
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
              {searchResults.map((user) => {
                const isSelected = selectedUsers.find((u) => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUserSelection(user)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-600/50'
                        : 'hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {getInitials(user.full_name || user.username)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-slate-50">{user.full_name}</div>
                      <div className="text-sm text-slate-400">@{user.username}</div>
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
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
            <p className="text-center text-slate-400 py-8">No users found</p>
          ) : (
            <p className="text-center text-slate-400 py-8">Search for users to start a chat</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateChat}
            disabled={loading || selectedUsers.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}