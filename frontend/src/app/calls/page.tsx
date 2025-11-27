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

  return (
    <AuthGuard>
      <div className="flex h-screen bg-slate-900">
        <Sidebar />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-50 mb-2">Calls</h1>
              <p className="text-slate-400">View your call history</p>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="divide-y divide-slate-700">
                {mockCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-4 hover:bg-slate-700/50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {call.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-50">{call.name}</h3>
                        <p className="text-sm text-slate-400">
                          {call.type} • {call.duration}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">{call.time}</p>
                      <button className="mt-1 text-blue-500 hover:text-blue-400 transition-colors">
                        Call back
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}