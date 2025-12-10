'use client';

import React from 'react';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callType?: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  callerName,
  callType = 'audio',
  onAccept,
  onReject,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-full max-w-sm mx-4">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl"></div>
        
        {/* Modal */}
        <div className="relative backdrop-blur-xl bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-cyan-500/30 animate-pulse">
            {callType === 'video' ? (
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-100 mb-2 text-center">
            Incoming {callType === 'video' ? 'Video' : 'Audio'} Call
          </h2>

          {/* Caller Name */}
          <p className="text-cyan-400 mb-6 text-center text-lg font-medium">
            {callerName}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onReject}
              className="relative flex-1 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-red-500 to-pink-600 hover:from-pink-500 hover:to-red-600 px-4 py-3 rounded-lg transition-all duration-300 text-white font-medium shadow-lg flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </div>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isProcessing) {
                  onAccept();
                }
              }}
              disabled={isProcessing}
              className="relative flex-1 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-500 hover:to-purple-600 px-4 py-3 rounded-lg transition-all duration-300 text-white font-medium shadow-lg flex items-center justify-center gap-2">
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accept
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

