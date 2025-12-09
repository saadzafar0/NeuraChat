'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: '/dashboard', icon: '💬', label: 'Chats' },
    { href: '/ai-agent', icon: '⚡', label: 'AI Agent' },
    { href: '/calls', icon: '📞', label: 'Calls' },
    { href: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-20 bg-gradient-to-b from-gray-900/95 to-gray-900/90 backdrop-blur-xl border-r border-gray-700/50 
          flex flex-col items-center py-6 space-y-8 relative
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
      {/* Vertical Neon Line */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-purple-500/50"></div>
      
      {/* Close Button (Mobile Only) */}
      {onMobileClose && (
        <button
          onClick={onMobileClose}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Logo with Glow Effect */}
      <Link href="/dashboard" onClick={handleLinkClick} className="flex items-center justify-center group">
        <div className="relative">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl blur-md opacity-75 group-hover:opacity-100 transition-opacity"></div>
          {/* Logo */}
          <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/50 group-hover:shadow-cyan-500/75 transition-all group-hover:scale-110 duration-300">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        </div>
      </Link>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col space-y-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className="relative group"
              title={item.label}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-r-full shadow-lg shadow-cyan-500/50"></div>
              )}
              
              {/* Icon Container */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-white shadow-lg shadow-cyan-500/30 scale-110'
                    : 'text-gray-400 hover:text-cyan-400 hover:bg-gray-800/50 hover:scale-105'
                }`}
              >
                {/* Glow on Hover */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-blue-500/0 group-hover:from-cyan-500/10 group-hover:to-blue-500/10 rounded-xl transition-all duration-300"></div>
                )}
                <span className="relative z-10">{item.icon}</span>
              </div>
              
              {/* Tooltip */}
              <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-lg text-sm text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl">
                {item.label}
                {/* Arrow */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800/90"></div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Avatar with Glow */}
      <div className="relative group cursor-pointer">
        {/* Glow Ring */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full blur-sm opacity-0 group-hover:opacity-75 transition-opacity"></div>
        {/* Avatar */}
        <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-cyan-500/30 border-2 border-gray-700/50 group-hover:border-cyan-500/50 transition-all group-hover:scale-110 duration-300">
          {user ? getInitials(user.full_name || user.username) : 'U'}
        </div>
        
        {/* Online Indicator */}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
      </div>

      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none"></div>
      </div>
    </>
  );
}