'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: '/dashboard', icon: '💬', label: 'Chats' },
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

  return (
    <div className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 space-y-8">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center justify-center">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white"
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
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col space-y-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
              title={item.label}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      {/* User Avatar */}
      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
        {user ? getInitials(user.full_name || user.username) : 'U'}
      </div>
    </div>
  );
}