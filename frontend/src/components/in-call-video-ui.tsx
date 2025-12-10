'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface InCallVideoUIProps {
  isOpen: boolean;
  otherUserName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerMuted: boolean;
  callStartedAt?: number | null;
  audioTrack?: any;
  videoTrack?: any;
  remoteVideoTracks: Map<number, any>;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export const InCallVideoUI: React.FC<InCallVideoUIProps> = ({
  isOpen,
  otherUserName,
  isMuted,
  isCameraOff,
  isSpeakerMuted,
  callStartedAt,
  audioTrack,
  videoTrack,
  remoteVideoTracks,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onEndCall,
}) => {
  const [elapsed, setElapsed] = useState('00:00');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  // Play local video
  useEffect(() => {
    if (videoTrack && localVideoRef.current) {
      try {
        const playPromise = videoTrack.play(localVideoRef.current);
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.error('Error playing local video:', err);
          });
        }
      } catch (err) {
        console.error('Error playing local video:', err);
      }
    }
    return () => {
      // Don't stop track here - it's managed by the call hook
    };
  }, [videoTrack]);

  // Play remote videos
  useEffect(() => {
    const remoteVideoContainer = document.getElementById('remote-video-container');
    if (!remoteVideoContainer) return;

    remoteVideoTracks.forEach((track, uid) => {
      let videoElement = remoteVideoRefs.current.get(uid);
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = `remote-video-${uid}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'w-full h-full object-cover';
        remoteVideoRefs.current.set(uid, videoElement);
        remoteVideoContainer.appendChild(videoElement);
      }
      try {
        const playPromise = track.play(videoElement);
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.error('Error playing remote video:', err);
          });
        }
      } catch (err) {
        console.error('Error playing remote video:', err);
      }
    });

    return () => {
      remoteVideoTracks.forEach((track, uid) => {
        const videoElement = remoteVideoRefs.current.get(uid);
        if (videoElement) {
          try {
            track.stop();
          } catch (err) {
            console.warn('Error stopping remote video track:', err);
          }
          videoElement.remove();
          remoteVideoRefs.current.delete(uid);
        }
      });
    };
  }, [remoteVideoTracks]);

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
  const hasRemoteVideo = remoteVideoTracks.size > 0;
  const remoteVideoArray = Array.from(remoteVideoTracks.entries());

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Remote Video - Main View */}
      <div className="flex-1 relative bg-gray-900">
        <div id="remote-video-container" className="w-full h-full">
          {!hasRemoteVideo && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-cyan-500/30 mx-auto">
                  <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {initials}
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-100 mb-1">{otherUserName}</h2>
                <p className="text-cyan-400 text-sm">Waiting for video...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Local Video - Picture in Picture */}
      {videoTrack ? (
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-cyan-500/50 shadow-2xl">
          {isCameraOff ? (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2 mx-auto">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">Camera Off</p>
              </div>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>
      ) : (
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600/50 shadow-2xl flex items-center justify-center">
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2 mx-auto">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">Camera unavailable</p>
            <p className="text-xs text-gray-500 mt-1">Receive-only mode</p>
          </div>
        </div>
      )}

      {/* Call Info Overlay */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
        <p className="text-white text-sm font-medium">{otherUserName}</p>
        <p className="text-cyan-400 text-xs">In call • {elapsed}</p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-4">
        <button
          onClick={onToggleMute}
          disabled={!audioTrack}
          className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            !audioTrack
              ? 'bg-gray-800/50 border-2 border-gray-700/50 opacity-50 cursor-not-allowed'
              : isMuted
              ? 'bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30'
              : 'bg-gray-700/50 border-2 border-gray-600/50 hover:bg-gray-700/70'
          }`}
          title={!audioTrack ? 'Microphone unavailable' : isMuted ? 'Unmute' : 'Mute'}
        >
          <div
            className={`absolute inset-0 rounded-full blur transition-opacity ${
              isMuted ? 'bg-red-500/50 opacity-75' : 'bg-cyan-500/50 opacity-0 group-hover:opacity-75'
            }`}
          />
          <svg className={`w-6 h-6 relative z-10 ${isMuted ? 'text-red-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        <button
          onClick={onToggleCamera}
          disabled={!videoTrack}
          className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            !videoTrack
              ? 'bg-gray-800/50 border-2 border-gray-700/50 opacity-50 cursor-not-allowed'
              : isCameraOff
              ? 'bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30'
              : 'bg-gray-700/50 border-2 border-gray-600/50 hover:bg-gray-700/70'
          }`}
          title={!videoTrack ? 'Camera unavailable' : isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          <div
            className={`absolute inset-0 rounded-full blur transition-opacity ${
              isCameraOff ? 'bg-red-500/50 opacity-75' : 'bg-cyan-500/50 opacity-0 group-hover:opacity-75'
            }`}
          />
          <svg className={`w-6 h-6 relative z-10 ${isCameraOff ? 'text-red-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCameraOff ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
        </button>

        <button
          onClick={onToggleSpeaker}
          className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
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
          <svg className={`w-6 h-6 relative z-10 ${isSpeakerMuted ? 'text-amber-300' : 'text-emerald-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSpeakerMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6M4 9v6h3l4 4V5L7 9H4z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9v6h3l4 4V5L7 9H4z M16 7a4 4 0 010 10m2-12a6 6 0 010 14" />
            )}
          </svg>
        </button>

        <button
          onClick={onEndCall}
          className="relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 bg-red-500/20 border-2 border-red-500/50 hover:bg-red-500/30"
          title="End Call"
        >
          <div className="absolute inset-0 bg-red-500/50 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity" />
          <svg className="w-6 h-6 text-red-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

