'use client';
import Link from 'next/link';
import React from 'react';

type OutgoingStatus = 'calling' | 'rejected';

interface OutgoingCallUIProps {
  otherUserName: string;
  status: OutgoingStatus;
  onCancel: () => void;
  onReturnToChat: () => void;
  onReturnToDashboard: () => void;
}

export const OutgoingCallUI: React.FC<OutgoingCallUIProps> = ({
  otherUserName,
  status,
  onCancel,
  onReturnToChat,
  onReturnToDashboard,
}) => {
  const initials = otherUserName ? otherUserName.charAt(0).toUpperCase() : '?';
  const isRejected = status === 'rejected';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />
        <div className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <Link
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault();
                onReturnToDashboard();
              }}
              className="text-slate-300 hover:text-white flex items-center gap-2 text-sm"
            >
              ← Back
            </Link>
            {!isRejected && (
              <button
                onClick={onCancel}
                className="text-slate-300 hover:text-white text-sm"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-cyan-500/40">
            <span className="text-3xl font-semibold text-white">{initials}</span>
          </div>

          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-semibold text-white truncate">{otherUserName || 'Unknown User'}</h2>
            {!isRejected ? (
              <div className="flex items-center justify-center gap-2 text-cyan-200">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent inline-block" />
                <span>Calling…</span>
              </div>
            ) : (
              <div className="text-rose-300 font-medium">Call rejected</div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
            {isRejected ? (
              <>
                <button
                  onClick={onReturnToChat}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
                >
                  Return to chat
                </button>
                <button
                  onClick={onReturnToDashboard}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition"
                >
                  Go to dashboard
                </button>
              </>
            ) : (
              <button
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-3 rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg hover:from-rose-600 hover:to-red-700 flex items-center justify-center gap-2 transition"
              >
                Cancel call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


