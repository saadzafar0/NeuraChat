'use client';

import React from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message?: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message = 'Are you sure you want to delete this item?',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-full max-w-sm mx-4">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-2xl blur-xl"></div>
        
        {/* Modal */}
        <div className="relative backdrop-blur-xl bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-100 mb-2 text-center">
            Confirm Delete
          </h2>

          {/* Message */}
          <p className="text-gray-400 mb-6 text-center text-sm">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700/30 hover:bg-gray-700/50 text-gray-200 rounded-lg transition-all duration-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="relative flex-1 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-red-500 to-pink-600 hover:from-pink-500 hover:to-red-600 px-4 py-2 rounded-lg transition-all duration-300 text-white font-medium shadow-lg">
                Delete
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;