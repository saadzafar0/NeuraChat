'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface AIMessageAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  originalMessage: string;
  onApply: (enhancedMessage: string) => void;
}

type AIAction = 
  | 'enhance' 
  | 'fix-grammar' 
  | 'translate' 
  | 'summarize' 
  | 'expand' 
  | 'make-formal' 
  | 'make-casual' 
  | 'add-empathy';

const aiActions = [
  {
    id: 'enhance' as AIAction,
    label: 'Enhance Message',
    description: 'Improve clarity and readability',
    icon: '✨',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'fix-grammar' as AIAction,
    label: 'Fix Grammar',
    description: 'Correct spelling and grammar',
    icon: '✓',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'translate' as AIAction,
    label: 'Translate',
    description: 'Convert to another language',
    icon: '🌐',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'summarize' as AIAction,
    label: 'Summarize',
    description: 'Make it shorter and concise',
    icon: '📄',
    color: 'from-orange-500 to-amber-500',
  },
  {
    id: 'expand' as AIAction,
    label: 'Expand',
    description: 'Add more detail and context',
    icon: '⚡',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'make-formal' as AIAction,
    label: 'Make Formal',
    description: 'Professional and polished',
    icon: '💼',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    id: 'make-casual' as AIAction,
    label: 'Make Casual',
    description: 'Friendly and conversational',
    icon: '💬',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'add-empathy' as AIAction,
    label: 'Add Empathy',
    description: 'More understanding and warm',
    icon: '❤️',
    color: 'from-red-500 to-pink-500',
  },
];

export default function AIMessageAssistant({
  isOpen,
  onClose,
  originalMessage,
  onApply,
}: AIMessageAssistantProps) {
  const [enhancedMessage, setEnhancedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AIAction | null>(null);
  const [error, setError] = useState('');

  const handleAIAction = async (action: AIAction) => {
    setLoading(true);
    setError('');
    setSelectedAction(action);

    try {
      // TODO: Replace with actual AI API call when backend is implemented
      // For now, simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulated responses based on action
      let result = originalMessage;
      switch (action) {
        case 'enhance':
          result = `✨ ${originalMessage} (Enhanced for better clarity)`;
          break;
        case 'fix-grammar':
          result = originalMessage.charAt(0).toUpperCase() + originalMessage.slice(1).trim() + '.';
          break;
        case 'translate':
          result = `[Translated] ${originalMessage}`;
          break;
        case 'summarize':
          result = originalMessage.split(' ').slice(0, Math.max(5, Math.floor(originalMessage.split(' ').length / 2))).join(' ') + '...';
          break;
        case 'expand':
          result = `${originalMessage} I wanted to elaborate further on this point and provide additional context to make the message more comprehensive.`;
          break;
        case 'make-formal':
          result = `Dear recipient, ${originalMessage} Kind regards.`;
          break;
        case 'make-casual':
          result = `Hey! ${originalMessage} 😊`;
          break;
        case 'add-empathy':
          result = `I understand how you feel. ${originalMessage} I'm here for you.`;
          break;
      }
      
      setEnhancedMessage(result);
    } catch (err: any) {
      setError(err.message || 'Failed to process message');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (enhancedMessage) {
      onApply(enhancedMessage);
      onClose();
      setEnhancedMessage('');
      setSelectedAction(null);
    }
  };

  const handleClose = () => {
    onClose();
    setEnhancedMessage('');
    setSelectedAction(null);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl"></div>
        
        {/* Modal */}
        <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                      AI Message Assistant
                    </span>
                  </h2>
                  <p className="text-sm text-gray-400">Choose how to enhance your message</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                type="button"
                title="Close AI Assistant"
                aria-label="Close AI Assistant"
                className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Original Message */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Original message:
              </label>
              <div className="p-4 bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-100">
                {originalMessage}
              </div>
            </div>

            {/* AI Actions Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {aiActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAIAction(action.id)}
                  disabled={loading}
                  className={`relative group p-4 rounded-lg border transition-all duration-300 text-left ${
                    selectedAction === action.id
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800/30 hover:bg-gray-800/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {/* Glow on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${action.color} opacity-0 group-hover:opacity-10 rounded-lg transition-opacity`}></div>
                  
                  <div className="relative flex items-start gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-lg`}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-100 text-sm mb-1">
                        {action.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {action.description}
                      </div>
                    </div>
                  </div>

                  {loading && selectedAction === action.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Enhanced Message Result */}
            {enhancedMessage && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enhanced message:
                </label>
                <textarea
                  value={enhancedMessage}
                  onChange={(e) => setEnhancedMessage(e.target.value)}
                  className="w-full min-h-[100px] p-4 bg-gray-900/50 backdrop-blur-sm border border-purple-500/50 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                  placeholder="AI enhanced message will appear here..."
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 backdrop-blur-sm bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Helper Text */}
            <div className="text-xs text-gray-500 italic">
              ✨ AI-powered suggestions to help you communicate better
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-700/50 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-700/30 hover:bg-gray-700/50 text-gray-200 font-medium rounded-lg transition-all duration-300"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!enhancedMessage}
              className="relative flex-1 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 hover:from-pink-500 hover:to-purple-600 px-4 py-2 rounded-lg transition-all duration-300 text-white font-medium shadow-lg">
                Apply Enhancement
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}