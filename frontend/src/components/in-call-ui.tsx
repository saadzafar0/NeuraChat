'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface InCallUIProps { isOpen: boolean; otherUserName: string; isMuted: boolean; isSpeakerMuted: boolean; callStartedAt?: number | null; audioTrack?: any; onToggleMute: () => void; onToggleSpeaker: () => void; onEndCall: () => void; }

export const InCallUI: React.FC<InCallUIProps> = ({
  isOpen,
  otherUserName,
  isMuted,
  isSpeakerMuted,
  callStartedAt,
  audioTrack,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}) => {
  const [levels, setLevels] = useState<number[]>(() => Array(12).fill(0));
  const [elapsed, setElapsed] = useState('00:00');
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!isOpen || !audioTrack) return;
    const track = audioTrack.getMediaStreamTrack?.() || audioTrack.getTrack?.(); if (!track) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.75; source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount); const bucketCount = 12;
    const update = () => { analyser.getByteFrequencyData(data); const bucketSize = Math.max(1, Math.floor(data.length / bucketCount));
      const next = Array.from({ length: bucketCount }, (_, idx) => { let sum = 0; const end = Math.min((idx + 1) * bucketSize, data.length); for (let i = idx * bucketSize; i < end; i++) sum += data[i]; return Math.min(100, Math.round(((sum / bucketSize) / 255) * 100)); });
      setLevels(next); rafRef.current = requestAnimationFrame(update); };
    update();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); source.disconnect(); analyser.disconnect(); ctx.close(); };
  }, [audioTrack, isOpen]);

  useEffect(() => {
    if (!callStartedAt || !isOpen) return;
    const format = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
    const tick = () => setElapsed(format(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000))));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callStartedAt, isOpen]);

  if (!isOpen) return null;

  const initials = useMemo(() => (otherUserName ? otherUserName.charAt(0).toUpperCase() : '?'), [otherUserName]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-full max-w-md mx-4">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />

        <div className="relative backdrop-blur-xl bg-gray-800/40 border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-cyan-500/30">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{initials}</div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-100 mb-1 text-center">{otherUserName}</h2>
          <p className="text-cyan-400 mb-6 text-center text-sm">In call • {elapsed}</p>

          <div className="flex items-end justify-center gap-1 h-20 max-w-xs mx-auto mb-6">
            {levels.map((level, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-sm bg-gradient-to-t from-gray-700 via-cyan-500 to-blue-500 transition-all duration-150"
                style={{ height: `${Math.max(10, level * 0.8)}%`, opacity: 0.4 + level / 200 }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onToggleMute}
              className={`relative group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                isMuted
                  ? 'bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30'
                  : 'bg-gray-700/50 border-2 border-gray-600/50 hover:bg-gray-700/70'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <div
                className={`absolute inset-0 rounded-full blur transition-opacity ${
                  isMuted ? 'bg-red-500/50 opacity-75' : 'bg-cyan-500/50 opacity-0 group-hover:opacity-75'
                }`}
              />
              <svg className={`w-8 h-8 relative z-10 ${isMuted ? 'text-red-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMuted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>

            <button
              onClick={onToggleSpeaker}
              className={`relative group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpeakerMuted
                  ? 'bg-amber-500/20 border-2 border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-gray-700/50 border-2 border-gray-600/50 hover:bg-gray-700/70'
              }`}
              title={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              <div
                className={`absolute inset-0 rounded-full blur transition-opacity ${
                  isSpeakerMuted ? 'bg-amber-500/50 opacity-75' : 'bg-emerald-500/40 opacity-0 group-hover:opacity-75'
                }`}
              />
              <svg className={`w-8 h-8 relative z-10 ${isSpeakerMuted ? 'text-amber-300' : 'text-emerald-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSpeakerMuted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6M4 9v6h3l4 4V5L7 9H4z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9v6h3l4 4V5L7 9H4z M16 7a4 4 0 010 10m2-12a6 6 0 010 14" />
                )}
              </svg>
            </button>

            <button
              onClick={onEndCall}
              className="relative group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30"
              title="End Call"
            >
              <div className="absolute inset-0 bg-red-500/50 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity" />
              <svg className="w-8 h-8 text-red-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

