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
  onMinimize: () => void;
  onClose: () => void;
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
  onMinimize,
  onClose,
}) => {
  const [elapsed, setElapsed] = useState('00:00');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  // Initialize position to top-right of remote video container (will be calculated on mount)
  const [localVideoPosition, setLocalVideoPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const localVideoBoxRef = useRef<HTMLDivElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);

  // Play local video - re-attach when track changes or camera is toggled
  useEffect(() => {
    if (!videoTrack || !localVideoRef.current) return;
    
    // When camera is enabled, ensure video is playing
    if (!isCameraOff) {
      // Small delay to ensure track.setEnabled(true) has taken effect
      const timeoutId = setTimeout(() => {
        if (!localVideoRef.current || isCameraOff) return;
        
        try {
          // Re-attach the video track to the element when camera is enabled
          // This ensures the video displays when toggled back on
          const playPromise = videoTrack.play(localVideoRef.current);
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((err: any) => {
              // Ignore "already playing" and "interrupted" errors - these are normal
              if (
                err?.name !== 'NotAllowedError' && 
                err?.message !== 'The play() request was interrupted' &&
                !err?.message?.includes('already playing')
              ) {
                console.warn('Error playing local video:', err);
              }
            });
          }
        } catch (err: any) {
          // Ignore "already playing" errors
          if (
            err?.name !== 'NotAllowedError' && 
            err?.message !== 'The play() request was interrupted' &&
            !err?.message?.includes('already playing')
          ) {
            console.error('Error playing local video:', err);
          }
        }
      }, 100); // Small delay to ensure track is enabled
      
      return () => clearTimeout(timeoutId);
    }
  }, [videoTrack, isCameraOff]);

  // Initialize position to top-right of remote video container on mount
  // This should work regardless of whether videoTrack exists
  useEffect(() => {
    if (!isOpen) return;
    
    const initializePosition = () => {
      if (remoteVideoContainerRef.current) {
        const container = remoteVideoContainerRef.current;
        const boxWidth = 192; // w-48 = 12rem = 192px
        const padding = 16; // 1rem = 16px
        const containerWidth = container.offsetWidth || container.clientWidth || window.innerWidth;
        
        if (containerWidth > 0) {
          setLocalVideoPosition((prev) => {
            // Only set if not already set
            if (prev === null) {
              return {
                x: Math.max(0, containerWidth - boxWidth - padding),
                y: padding,
              };
            }
            return prev;
          });
          return true; // Successfully initialized
        }
      }
      return false; // Not ready yet
    };
    
    // Try multiple times with different strategies
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryInitialize = () => {
      attempts++;
      const success = initializePosition();
      
      if (!success && attempts < maxAttempts) {
        // Try again with increasing delays
        setTimeout(tryInitialize, 50 * attempts);
      }
    };
    
    // Try immediately
    if (!initializePosition()) {
      // Use requestAnimationFrame for next frame
      requestAnimationFrame(() => {
        if (!initializePosition()) {
          // Fallback to setTimeout
          setTimeout(tryInitialize, 50);
        }
      });
    }
    
    // Handle window resize
    const handleResize = () => {
      initializePosition();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Drag handlers for local video box
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    e.preventDefault();
    e.stopPropagation();
    
    if (localVideoBoxRef.current && remoteVideoContainerRef.current) {
      const rect = localVideoBoxRef.current.getBoundingClientRect();
      const containerRect = remoteVideoContainerRef.current.getBoundingClientRect();
      
      // Initialize position if not set
      if (localVideoPosition === null) {
        const boxWidth = 192;
        const padding = 16;
        setLocalVideoPosition({
          x: containerRect.width - boxWidth - padding,
          y: padding,
        });
      }
      
      // Calculate drag offset relative to remote video container
      const currentX = localVideoPosition?.x ?? (containerRect.width - rect.width - 16);
      const currentY = localVideoPosition?.y ?? 16;
      
      setDragStart({
        x: e.clientX - containerRect.left - currentX,
        y: e.clientY - containerRect.top - currentY,
      });
      
      setIsDragging(true);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!localVideoBoxRef.current || !remoteVideoContainerRef.current) return;
      
      const containerRect = remoteVideoContainerRef.current.getBoundingClientRect();
      const boxRect = localVideoBoxRef.current.getBoundingClientRect();
      const boxWidth = boxRect.width || 192; // w-48 = 12rem = 192px
      const boxHeight = boxRect.height || 144; // h-36 = 9rem = 144px
      
      // Calculate new position relative to remote video container
      // Use the mouse position minus the offset from where we started dragging
      let newX = e.clientX - containerRect.left - dragStart.x;
      let newY = e.clientY - containerRect.top - dragStart.y;
      
      // Constrain to remote video container bounds with padding
      const padding = 8;
      const maxX = containerRect.width - boxWidth - padding;
      const maxY = containerRect.height - boxHeight - padding;
      newX = Math.max(padding, Math.min(newX, maxX));
      newY = Math.max(padding, Math.min(newY, maxY));
      
      // Only update if position is valid
      if (!isNaN(newX) && !isNaN(newY) && isFinite(newX) && isFinite(newY)) {
        setLocalVideoPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

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
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <button
          onClick={onMinimize}
          className="text-gray-300 hover:text-white bg-gray-800/70 border border-gray-700/70 rounded-full p-2 transition"
          title="Minimize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-white bg-gray-800/70 border border-gray-700/70 rounded-full p-2 transition"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Remote Video - Main View (Big Rectangle) */}
      <div ref={remoteVideoContainerRef} className="flex-1 relative bg-gray-900">
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

        {/* Local Video - Picture in Picture (Draggable) - Positioned inside remote video container */}
        {/* Always render this box, even if videoTrack is not available */}
        <div
          ref={localVideoBoxRef}
          className="absolute w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 shadow-2xl relative select-none z-50"
          style={{
            ...(localVideoPosition
              ? {
                  left: `${localVideoPosition.x}px`,
                  top: `${localVideoPosition.y}px`,
                  right: 'auto',
                }
              : {
                  // Fallback positioning - top-right corner
                  right: '1rem',
                  top: '1rem',
                  left: 'auto',
                }),
            borderColor: videoTrack ? 'rgba(6, 182, 212, 0.5)' : 'rgba(75, 85, 99, 0.5)',
            cursor: isDragging ? 'grabbing' : 'default',
            // Ensure box is always visible
            visibility: 'visible',
            display: 'block',
          }}
        >
        {/* Drag handle area */}
        <div
          className="absolute top-0 left-0 right-0 h-6 bg-gray-900/50 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 hover:bg-gray-900/70 transition-colors"
          onMouseDown={handleMouseDown}
        >
          <div className="w-8 h-1 bg-gray-500 rounded-full"></div>
        </div>
        
        {/* Show video if available */}
        {videoTrack ? (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isCameraOff ? 'opacity-0' : ''}`}
              draggable={false}
              style={{ pointerEvents: 'none' }}
            />
            {/* Overlay "Camera Off" message when camera is disabled */}
            {isCameraOff && (
              <div className="absolute inset-0 w-full h-full bg-gray-900 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2 mx-auto">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400">Camera Off</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Show "Camera unavailable" message when no video track */
          <div className="w-full h-full flex items-center justify-center">
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
      </div>
      </div>
      {/* End Remote Video Container - Local video box is inside this container */}

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

