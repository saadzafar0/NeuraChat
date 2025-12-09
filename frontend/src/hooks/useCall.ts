/** Agora RTM-based call hook (audio only) */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { joinAudioCall, leaveAudioCall } from '@/lib/agora';
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
  audioTrack?: any;
  uid?: number;
};

export const useCall = () => {
  const { user } = useAuth();
  const [storeState, setStoreState] = useState(callSessionStore.getState());
  const { callState, currentCall, isMuted, isSpeakerMuted, callStartedAt, remoteTracks } = storeState;
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joiningRef = useRef(false);
  const rtmReadyRef = useRef(false);
  const remoteTracksRef = useRef<any[]>(remoteTracks || []);

  const resetCall = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    if (currentCall?.audioTrack) {
      await leaveAudioCall(currentCall.audioTrack).catch(() => {});
    }
    remoteTracksRef.current.forEach((t) => { try { t.stop?.(); } catch {} });
    remoteTracksRef.current = [];
    callSessionStore.reset();
    joiningRef.current = false;
  }, [currentCall]);

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
      } catch (err) {
        console.error('RTM connect failed', err);
        rtmReadyRef.current = false;
        timeoutRef.current && clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        return;
      }

      rtmReadyRef.current = true;
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
            },
          });
          timeoutRef.current = setTimeout(resetCall, 20000);
        }
        if (type === 'call-accept') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          const nextCall = currentCall || {
            callId: payload.callId,
            chatId: payload.chatId || '',
            channelName: payload.channelName,
            toUserId: payload.toUserId,
            fromUserId: payload.fromUserId,
            isCaller: true,
            displayName: currentCall?.displayName,
          };
          const startedAt = payload.startedAt || callSessionStore.getState().callStartedAt || Date.now();
          callSessionStore.update({
            currentCall: nextCall,
            callState: 'in-call',
            callStartedAt: startedAt,
          });
          handleJoin(payload.callId, payload.channelName);
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
            displayName: currentCall?.displayName,
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
                  displayName: currentCall.displayName,
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
    async (callId: string, channelName: string) => {
      if (!user || joiningRef.current) return;
      joiningRef.current = true;
      try {
        const joinRes: any = await api.joinCall(callId);
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
        const latestState = callSessionStore.getState();
        const existingCall = latestState.currentCall || currentCall;
        const nextCallStartedAt = latestState.callStartedAt ?? callStartedAt ?? Date.now();

        callSessionStore.update({
          currentCall: existingCall
            ? {
                ...existingCall,
                audioTrack,
                uid,
                channelName: channelName || existingCall.channelName,
                chatId:
                  existingCall.chatId ||
                  latestState.currentCall?.chatId ||
                  currentCall?.chatId ||
                  joinRes.chatId ||
                  '',
              }
            : { callId, chatId: joinRes.chatId || '', channelName, isCaller: false, audioTrack, uid },
          callState: 'in-call',
          callStartedAt: nextCallStartedAt,
          remoteTracks: remoteTracksRef.current,
        });
      } catch (err) {
        console.error('Join call failed', err);
        resetCall();
      } finally {
        joiningRef.current = false;
      }
    },
    [appId, resetCall, user]
  );

  const initiateCall = useCallback(
    async (chatId: string, toUserId: string, displayName?: string) => {
      if (!user || callState !== 'idle' || !rtmReadyRef.current) return;
      try {
        const created: any = await api.createCall({ chatId, type: 'audio' });
        const callId = created?.call?.id || created?.callId || `call_${Date.now()}`;
        const channelName = `chat_${chatId}`;
        callSessionStore.update({
          currentCall: { callId, chatId, channelName, toUserId, isCaller: true, displayName },
          callState: 'calling',
        });
        await rtmClient.send(toUserId, {
          type: 'call-invite',
          callId,
        chatId,
        channelName,
          fromUserId: user.id,
        });
        timeoutRef.current = setTimeout(() => resetCall(), 20000);
      } catch (err) {
        console.error('Call initiate failed', err);
        resetCall();
      }
    },
    [callState, resetCall, user]
  );

  const acceptCall = useCallback(async () => {
    if (!currentCall || callState !== 'ringing' || !rtmReadyRef.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const startedAt = Date.now();
    callSessionStore.update({ callState: 'calling', callStartedAt: startedAt });
    try {
      await rtmClient.send(currentCall.fromUserId!, {
        type: 'call-accept',
        callId: currentCall.callId,
        channelName: currentCall.channelName,
        chatId: currentCall.chatId,
        startedAt,
      });
      // Optimistically show in-call UI while joining
      callSessionStore.update({ callState: 'in-call', callStartedAt: startedAt });
      await handleJoin(currentCall.callId, currentCall.channelName);
    } catch (err) {
      console.error('Accept failed', err);
      resetCall();
    }
  }, [callState, currentCall, handleJoin, resetCall]);

  const rejectCall = useCallback(async () => {
    if (!currentCall || callState !== 'ringing' || !rtmReadyRef.current) return;
    try {
      await rtmClient.send(currentCall.fromUserId!, {
        type: 'call-reject',
        callId: currentCall.callId,
      });
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
    try {
      if (peerId && rtmReadyRef.current) {
        await rtmClient.send(peerId, { type: 'call-end', callId: currentCall.callId });
      }
      socketClient.callEnd({ otherUserId: peerId || '', callId: currentCall.callId });
    } catch {}
    await resetCall();
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

  useEffect(() => {
    const unsub = callSessionStore.subscribe((next) => {
      setStoreState(next);
      remoteTracksRef.current = next.remoteTracks || [];
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    socketClient.onReady(() => {
      socketClient.onCallAccepted(({ callId, channelName, callerId }: any) => {
        callSessionStore.update({
          currentCall: {
            callId,
            chatId: '',
            channelName,
            toUserId: callerId,
            isCaller: true,
          },
          callState: 'calling',
        });
        handleJoin(callId, channelName);
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
          displayName: active?.displayName,
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
                displayName: active.displayName,
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
    isSpeakerMuted,
    callStartedAt,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    resetCallSession: resetCall,
  };
};

