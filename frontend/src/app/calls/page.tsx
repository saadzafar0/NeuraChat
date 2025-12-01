// app/calls/page.tsx
'use client';

import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function CallsPage() {
  const mockCalls = [
    { id: 1, name: 'Sarah Chen', type: 'Incoming', duration: '5:32', time: '2h ago', missed: false },
    { id: 2, name: 'Michael Rodriguez', type: 'Outgoing', duration: '12:45', time: '5h ago', missed: false },
    { id: 3, name: 'Emily Johnson', type: 'Missed', duration: '-', time: '1d ago', missed: true },
    { id: 4, name: 'David Park', type: 'Incoming', duration: '3:21', time: '2d ago', missed: false },
  ];

  const getCallIcon = (type: string, missed: boolean) => {
    if (missed) {
      return (
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      );
    }
    
    if (type === 'Incoming') {
      return (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    }

    return (
      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
      </svg>
    );
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

        <Sidebar />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-6xl mx-auto p-8">
            {/* Header with Gradient */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Calls
                </span>
              </h1>
              <p className="text-gray-400">View your call history</p>
            </div>

            {/* Glass Card Container */}
            <div className="relative backdrop-blur-xl bg-gray-800/40 rounded-2xl border border-gray-700/50 overflow-hidden shadow-2xl">
              {/* Neon Border Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="divide-y divide-gray-700/50 relative z-10">
                {mockCalls.map((call) => (
                  <div
                    key={call.id}
                    className="group p-5 hover:bg-gray-700/30 transition-all duration-300 flex items-center justify-between relative"
                  >
                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                      {/* Avatar with Gradient */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                          {call.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-100 mb-1 group-hover:text-cyan-400 transition-colors">
                          {call.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm">
                          {getCallIcon(call.type, call.missed)}
                          <span className={call.missed ? 'text-red-400' : 'text-gray-400'}>
                            {call.type}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">{call.duration}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right relative z-10">
                      <p className="text-sm text-gray-400 mb-2">{call.time}</p>
                      <button className="relative group/btn">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-0 group-hover/btn:opacity-75 transition-opacity"></div>
                        <div className="relative bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500 hover:to-blue-600 text-cyan-400 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 border border-cyan-500/30 hover:border-transparent text-sm">
                          Call back
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}