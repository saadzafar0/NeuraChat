'use client';

import { useEffect, useState } from 'react';

type CallFloatingBarProps = {
  otherUserName: string;
  callType: 'audio' | 'video';
  callStartedAt?: number | null;
  isMuted: boolean;
  isSpeakerMuted: boolean;
  onResume: () => void;
  onEnd: () => void;
};

export const CallFloatingBar = ({
  otherUserName,
  callType,
  callStartedAt,
  isMuted,
  isSpeakerMuted,
  onResume,
  onEnd,
}: CallFloatingBarProps) => {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!callStartedAt) return;
    const format = (secs: number) =>
      `${Math.floor(secs / 60)
        .toString()
        .padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
    const tick = () => {
      setElapsed(format(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000))));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gray-900/80 backdrop-blur-xl shadow-2xl px-4 py-3 w-72">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold flex items-center justify-center">
          {otherUserName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-100 truncate">{otherUserName || 'In call'}</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              {callType === 'video' ? 'Video' : 'Audio'}
            </span>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span>In call • {elapsed}</span>
            {isMuted && <span className="text-red-300">Muted</span>}
            {isSpeakerMuted && <span className="text-amber-300">Speaker off</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResume}
            className="px-2 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-md hover:from-cyan-400 hover:to-blue-500 transition"
            title="Return to call"
          >
            Open
          </button>
          <button
            onClick={onEnd}
            className="p-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 transition"
            title="End call"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

