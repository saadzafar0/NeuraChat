/** Agora RTM-based call hook (audio only) */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { joinAudioCall, leaveAudioCall, joinVideoCall, leaveVideoCall } from '@/lib/agora';
import { rtmClient } from '@/lib/agoraRtm';
import socketClient from '@/lib/socket';
import { callSessionStore } from '@/lib/callSessionStore';

type CallState = 'idle' | 'calling' | 'ringing' | 'in-call' | 'rejected';
type CurrentCall = {
  callId: string;
  chatId: string;
  channelName: string;
  toUserId?: string;
  fromUserId?: string;
  displayName?: string;
  isCaller: boolean;
  callType?: 'audio' | 'video';
  audioTrack?: any;
  videoTrack?: any;
  uid?: number;
};

export const useCall = () => {
  const { user } = useAuth();
  const [storeState, setStoreState] = useState(callSessionStore.getState());
  const { callState, currentCall, isMuted, isCameraOff, isSpeakerMuted, callStartedAt, remoteTracks, remoteVideoTracks, isCallUiMinimized } = storeState;
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joiningRef = useRef(false);
  const rtmReadyRef = useRef(false);
  const remoteTracksRef = useRef<any[]>(remoteTracks || []);

  const remoteVideoTracksRef = useRef<Map<number, any>>(new Map());

  const resetCall = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    if (currentCall?.callType === 'video') {
      await leaveVideoCall(currentCall.audioTrack, currentCall.videoTrack).catch(() => {});
    } else if (currentCall?.audioTrack) {
      await leaveAudioCall(currentCall.audioTrack).catch(() => {});
    }
    remoteTracksRef.current.forEach((t) => { try { t.stop?.(); } catch {} });
    remoteTracksRef.current = [];
    remoteVideoTracksRef.current.forEach((t) => { try { t.stop?.(); t.close?.(); } catch {} });
    remoteVideoTracksRef.current.clear();
    callSessionStore.reset();
    joiningRef.current = false;
  }, [currentCall]);

  const minimizeCallUi = useCallback(() => {
    callSessionStore.update({ isCallUiMinimized: true });
  }, []);

  const restoreCallUi = useCallback(() => {
    callSessionStore.update({ isCallUiMinimized: false });
  }, []);

  // RTM setup
  useEffect(() => {
    if (!user || !appId) return;
    (async () => {
      // Fetch RTM token from backend (required when dynamic keys are enabled)
      let rtmToken: string | undefined;
      try {
        const res: any = await api.getRtmToken();
        rtmToken = res?.token;
      } catch (err) {
        console.error('Failed to fetch RTM token', err);
        return;
      }

      const fetchFreshToken = async () => {
        const res: any = await api.getRtmToken();
        return res?.token as string;
      };

      try {
        await rtmClient.connect(appId, user.id, rtmToken, fetchFreshToken);
        rtmReadyRef.current = true;
        console.log('[RTM] Ready for call signaling');
      } catch (err: any) {
        console.error('[RTM] Connection failed after retries:', err);
        rtmReadyRef.current = false;
        timeoutRef.current && clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        
        // Don't block the app - calls can still work via Socket.IO
        // But log a warning that RTM features won't work
        console.warn('[RTM] RTM connection unavailable. Peer-to-peer signaling will be limited. Calls will still work via Socket.IO.');
        return;
      }
      rtmClient.onMessage((_from, payload) => {
        const { type } = payload || {};
        if (type === 'call-invite') {
          if (callState !== 'idle') return;
          callSessionStore.update({
            callState: 'ringing',
            currentCall: {
              callId: payload.callId,
              chatId: payload.chatId,
              channelName: payload.channelName,
              fromUserId: payload.fromUserId,
              isCaller: false,
              callType: payload.callType || 'audio',
            },
            isCallUiMinimized: false,
          });
          timeoutRef.current = setTimeout(resetCall, 20000);
        }
        if (type === 'call-accept') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          const nextCall: CurrentCall = currentCall ? {
            ...currentCall,
            callId: payload.callId,
            chatId: payload.chatId || currentCall.chatId,
            channelName: payload.channelName,
            toUserId: payload.toUserId,
            fromUserId: payload.fromUserId,
            isCaller: true,
            callType: payload.callType || 'audio',
          } : {
            callId: payload.callId,
            chatId: payload.chatId || '',
            channelName: payload.channelName,
            toUserId: payload.toUserId,
            fromUserId: payload.fromUserId,
            isCaller: true,
            callType: payload.callType || 'audio',
          };
          const startedAt = payload.startedAt || callSessionStore.getState().callStartedAt || Date.now();
          callSessionStore.update({
            currentCall: nextCall,
            callState: 'in-call',
            callStartedAt: startedAt,
          });
          handleJoin(payload.callId, payload.channelName, payload.callType || 'audio');
        }
        if (type === 'call-reject') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          const fallbackCall: CurrentCall = {
            callId: payload.callId || currentCall?.callId || '',
            chatId: payload.chatId || currentCall?.chatId || '',
            channelName: payload.channelName || currentCall?.channelName || '',
            isCaller: true,
            fromUserId: payload.fromUserId || currentCall?.fromUserId,
            toUserId: payload.toUserId || currentCall?.toUserId,
          };
          callSessionStore.update({
            callState: 'rejected',
            currentCall: currentCall
              ? {
                  ...currentCall,
                  callId: payload.callId || currentCall.callId,
                  chatId: payload.chatId || currentCall.chatId,
                  channelName: payload.channelName || currentCall.channelName,
                  fromUserId: payload.fromUserId || currentCall.fromUserId,
                  toUserId: payload.toUserId || currentCall.toUserId,
                }
              : fallbackCall,
          });
        }
        if (type === 'call-end' && payload.callId === currentCall?.callId) {
          resetCall();
        }
      });
    })();
    // no teardown to preserve state across fast refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, appId]); // limit to identity/app changes to avoid re-login loops

  const handleJoin = useCallback(
    async (callId: string, channelName: string, callType: 'audio' | 'video' = 'audio', localVideoElement?: HTMLVideoElement | null) => {
      if (!user || joiningRef.current) return;
      joiningRef.current = true;
      try {
        const joinRes: any = await api.joinCall(callId);
        const latestState = callSessionStore.getState();
        const existingCall = latestState.currentCall || currentCall;
        const callTypeToUse = callType || existingCall?.callType || 'audio';

        if (callTypeToUse === 'video') {
          let audioTrack: any = null;
          let videoTrack: any = null;
          let uid: number | undefined;
          
          try {
            const result = await joinVideoCall({
              appId,
              token: joinRes.token,
              channelName: channelName || joinRes.channelName,
              uid: joinRes.uid,
              localVideoElement,
              onRemoteVideo: (track, remoteUid) => {
                remoteVideoTracksRef.current.set(remoteUid, track);
                callSessionStore.update({
                  remoteVideoTracks: new Map(remoteVideoTracksRef.current),
                });
              },
              onRemoteAudio: (track) => {
                remoteTracksRef.current.push(track);
                track.setVolume?.(isSpeakerMuted ? 0 : 100);
              },
              onUserLeft: async (leftUid) => {
                remoteVideoTracksRef.current.delete(leftUid as number);
                callSessionStore.update({
                  remoteVideoTracks: new Map(remoteVideoTracksRef.current),
                });
                if (remoteVideoTracksRef.current.size === 0 && remoteTracksRef.current.length === 0) {
                  await resetCall();
                }
              },
            });
            // Result will always have tracks (even if null) - this allows receive-only mode
            audioTrack = result?.audioTrack || null;
            videoTrack = result?.videoTrack || null;
            uid = result?.uid || joinRes.uid;
            
            if (!audioTrack && !videoTrack) {
              console.log('ℹ️ Joined in receive-only mode - can receive remote video/audio');
            }
          } catch (error: any) {
            console.error('Failed to join video call:', error);
            // If permission denied, show user-friendly error and reset call
            if (error?.message?.includes('permission') || error?.code === 'PERMISSION_DENIED' || error?.name === 'NotAllowedError') {
              alert('Camera and microphone permissions are required for video calls. Please grant permissions in your browser settings and try again.');
              await resetCall();
              return;
            }
            // For any other error (including device in use), still proceed with receive-only mode
            // This is crucial for testing on the same device with multiple browsers
            console.warn('⚠️ Error during join, but proceeding in receive-only mode:', error.message);
            audioTrack = null;
            videoTrack = null;
            uid = joinRes.uid;
          }
          const nextCallStartedAt = latestState.callStartedAt ?? callStartedAt ?? Date.now();

          callSessionStore.update({
            currentCall: existingCall
              ? {
                  ...existingCall,
                  audioTrack,
                  videoTrack,
                  uid,
                  callType: 'video',
                  channelName: channelName || existingCall.channelName,
                  chatId:
                    existingCall.chatId ||
                    latestState.currentCall?.chatId ||
                    currentCall?.chatId ||
                    joinRes.chatId ||
                    '',
                }
              : { callId, chatId: joinRes.chatId || '', channelName, isCaller: false, callType: 'video', audioTrack, videoTrack, uid },
            callState: 'in-call',
            callStartedAt: nextCallStartedAt,
            remoteTracks: remoteTracksRef.current,
            remoteVideoTracks: new Map(remoteVideoTracksRef.current),
            isCallUiMinimized: false,
          });
        } else {
          const { audioTrack, uid } = await joinAudioCall({
            appId,
            token: joinRes.token,
            channelName: channelName || joinRes.channelName,
            uid: joinRes.uid,
            onRemoteAudio: (track) => {
              remoteTracksRef.current.push(track);
              track.setVolume?.(isSpeakerMuted ? 0 : 100);
            },
            onUserLeft: async () => {
              await resetCall();
            },
          });
          const nextCallStartedAt = latestState.callStartedAt ?? callStartedAt ?? Date.now();

          callSessionStore.update({
            currentCall: existingCall
              ? {
                  ...existingCall,
                  audioTrack,
                  uid,
                  callType: 'audio',
                  channelName: channelName || existingCall.channelName,
                  chatId:
                    existingCall.chatId ||
                    latestState.currentCall?.chatId ||
                    currentCall?.chatId ||
                    joinRes.chatId ||
                    '',
                }
              : { callId, chatId: joinRes.chatId || '', channelName, isCaller: false, callType: 'audio', audioTrack, uid },
            callState: 'in-call',
            callStartedAt: nextCallStartedAt,
            remoteTracks: remoteTracksRef.current,
            isCallUiMinimized: false,
          });
        }
      } catch (err) {
        console.error('Join call failed', err);
        resetCall();
      } finally {
        joiningRef.current = false;
      }
    },
    [appId, resetCall, user, isSpeakerMuted, currentCall, callStartedAt]
  );

  const initiateCall = useCallback(
    async (chatId: string, toUserId: string, displayName?: string, callType: 'audio' | 'video' = 'audio') => {
      if (!user || callState !== 'idle') return;
      
      // RTM is preferred but not required - Socket.IO will handle signaling
      if (!rtmReadyRef.current) {
        console.warn('[Call] RTM not ready, using Socket.IO only for signaling');
      }
      
      try {
        const created: any = await api.createCall({ chatId, type: callType });
        const callId = created?.call?.id || created?.callId || `call_${Date.now()}`;
        const channelName = `chat_${chatId}`;
        callSessionStore.update({
          currentCall: { callId, chatId, channelName, toUserId, isCaller: true, callType },
          callState: 'calling',
          isCallUiMinimized: false,
        });
        
        // Try RTM first, fall back to Socket.IO if RTM fails
        if (rtmReadyRef.current) {
          try {
            await rtmClient.send(toUserId, {
              type: 'call-invite',
              callId,
              chatId,
              channelName,
              callType,
              fromUserId: user.id,
            });
          } catch (rtmErr) {
            console.warn('[Call] RTM send failed, using Socket.IO only:', rtmErr);
          }
        }
        
        // Always use Socket.IO as primary/backup signaling
        socketClient.callInitiate({ chatId, toUserId, callId, callType });
        timeoutRef.current = setTimeout(() => resetCall(), 20000);
      } catch (err) {
        console.error('Call initiate failed', err);
        resetCall();
      }
    },
    [callState, resetCall, user]
  );

  const acceptCall = useCallback(async () => {
    if (!currentCall || callState !== 'ringing') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const startedAt = Date.now();
    callSessionStore.update({ callState: 'calling', callStartedAt: startedAt, isCallUiMinimized: false });
    try {
      // Try RTM first, but don't fail if it's not available
      if (rtmReadyRef.current) {
        try {
          await rtmClient.send(currentCall.fromUserId!, {
            type: 'call-accept',
            callId: currentCall.callId,
            channelName: currentCall.channelName,
            chatId: currentCall.chatId,
            callType: currentCall.callType || 'audio',
            startedAt,
          });
        } catch (rtmErr) {
          console.warn('[Call] RTM accept send failed, continuing with Socket.IO:', rtmErr);
        }
      }
      
      // Also send via Socket.IO (this is the primary method)
      socketClient.callAccept({
        chatId: currentCall.chatId,
        channelName: currentCall.channelName,
        callerId: currentCall.fromUserId!,
        callId: currentCall.callId,
      });
      
      // Optimistically show in-call UI while joining
      callSessionStore.update({ callState: 'in-call', callStartedAt: startedAt });
      // For video calls, the local video element will be handled by the InCallVideoUI component
      await handleJoin(currentCall.callId, currentCall.channelName, currentCall.callType || 'audio', null);
    } catch (err) {
      console.error('Accept failed', err);
      resetCall();
    }
  }, [callState, currentCall, handleJoin, resetCall]);

  const rejectCall = useCallback(async () => {
    if (!currentCall || callState !== 'ringing') return;
    try {
      // Try RTM first
      if (rtmReadyRef.current) {
        try {
          await rtmClient.send(currentCall.fromUserId!, {
            type: 'call-reject',
            callId: currentCall.callId,
          });
        } catch (rtmErr) {
          console.warn('[Call] RTM reject send failed:', rtmErr);
        }
      }
      // Always use Socket.IO as well
      socketClient.callReject({ callerId: currentCall.fromUserId!, callId: currentCall.callId });
    } catch {}
    resetCall();
  }, [callState, currentCall, resetCall]);

  const endCall = useCallback(async () => {
    if (!currentCall) {
      await resetCall();
      return;
    }
    const peerId = currentCall.isCaller ? currentCall.toUserId : currentCall.fromUserId;
    const callId = currentCall.callId;
    
    try {
      // Call backend API to end the call (updates database and allows any participant to end)
      try {
        await api.endCall(callId);
      } catch (apiErr: any) {
        // If API call fails (e.g., 403 if not initiator), still proceed with socket signaling
        console.warn('[Call] API endCall failed (non-fatal):', apiErr?.message || apiErr);
      }
      
      // Send signaling via RTM (optional, best-effort)
      if (peerId && rtmReadyRef.current) {
        try {
          await rtmClient.send(peerId, { type: 'call-end', callId });
        } catch (rtmErr) {
          console.warn('[Call] RTM end send failed:', rtmErr);
        }
      }
      
      // Always send via Socket.IO (this broadcasts to all participants)
      socketClient.callEnd({ otherUserId: peerId || '', callId });
      
      // Immediately clean up local tracks and reset state
      // The socket event will trigger resetCall on the other side
      await resetCall();
    } catch (err) {
      console.error('[Call] Error ending call:', err);
      // Still reset local state even if signaling fails
      await resetCall();
    }
  }, [currentCall, resetCall]);

  const toggleMute = useCallback(() => {
    if (!currentCall?.audioTrack) return;
    const muted = !isMuted;
    currentCall.audioTrack.setEnabled(!muted);
    callSessionStore.update({ isMuted: muted });
  }, [currentCall, isMuted]);

  const toggleSpeaker = useCallback(() => {
    const muted = !isSpeakerMuted;
    callSessionStore.update({ isSpeakerMuted: muted });
    remoteTracksRef.current.forEach((t) => {
      try {
        t.setVolume?.(muted ? 0 : 100);
      } catch {}
    });
  }, [isSpeakerMuted]);

  const toggleCamera = useCallback(() => {
    if (!currentCall?.videoTrack) return;
    const cameraOff = !isCameraOff;
    currentCall.videoTrack.setEnabled(!cameraOff);
    callSessionStore.update({ isCameraOff: cameraOff });
  }, [currentCall, isCameraOff]);

  useEffect(() => {
    const unsub = callSessionStore.subscribe((next) => {
      setStoreState(next);
      remoteTracksRef.current = next.remoteTracks || [];
      remoteVideoTracksRef.current = next.remoteVideoTracks || new Map();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    socketClient.onReady(() => {
      // Handle incoming call from Socket.IO (with caller info from server)
      socketClient.onIncomingCall(({ callId, chatId, channelName, fromUserId, fromUserName, fromUserAvatar, callType }: any) => {
        const currentState = callSessionStore.getState();
        if (currentState.callState !== 'idle') return; // Already in a call
        
        callSessionStore.update({
          callState: 'ringing',
          currentCall: {
            callId,
            chatId,
            channelName,
            fromUserId,
            fromUserName: fromUserName || 'Unknown',
            fromUserAvatar: fromUserAvatar || null,
            isCaller: false,
            callType: callType || 'audio',
          },
          isCallUiMinimized: false,
        });
        timeoutRef.current = setTimeout(resetCall, 20000);
      });

      socketClient.onCallAccepted(({ callId, channelName, callerId, callType }: any) => {
        callSessionStore.update({
          currentCall: {
            callId,
            chatId: '',
            channelName,
            toUserId: callerId,
            isCaller: true,
            callType: callType || 'audio',
          },
          callState: 'calling',
          isCallUiMinimized: false,
        });
        // Add a small delay to avoid race condition when both sides try to access device simultaneously
        // This gives the recipient time to finish setting up their tracks first
        setTimeout(() => {
          handleJoin(callId, channelName, callType || 'audio');
        }, 1000); // 1 second delay
      });

      socketClient.onCallRejected(({ callId }: any) => {
        const active = callSessionStore.getState().currentCall;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const fallbackCall: CurrentCall = {
          callId: callId || active?.callId || '',
          chatId: active?.chatId || '',
          channelName: active?.channelName || '',
          isCaller: true,
          fromUserId: active?.fromUserId,
          toUserId: active?.toUserId,
        };
        callSessionStore.update({
          callState: 'rejected',
          currentCall: active
            ? {
                ...active,
                callId: callId || active.callId,
                chatId: active.chatId,
                channelName: active.channelName,
                fromUserId: active.fromUserId,
                toUserId: active.toUserId,
              }
            : fallbackCall,
        });
      });

      socketClient.onCallEnded(({ callId }: any) => {
        if (callSessionStore.getState().currentCall?.callId === callId) {
          resetCall();
        }
      });
    });

    return () => {
      socketClient.offIncomingCall();
      socketClient.offCallAccepted();
      socketClient.offCallRejected();
      socketClient.offCallEnded();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleJoin, resetCall]);

  return {
    callState,
    currentCall,
    isMuted,
    isCameraOff,
    isSpeakerMuted,
    callStartedAt,
    remoteVideoTracks,
    isCallUiMinimized,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    resetCallSession: resetCall,
    handleJoin,
    minimizeCallUi,
    restoreCallUi,
  };
};

