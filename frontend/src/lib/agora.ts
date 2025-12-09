'use client';

// Dynamic import to avoid SSR issues - Agora SDK is only loaded on client side
let AgoraRTC: any = null;
let clientInstance: any = null;
let isJoining = false; // Global lock to prevent concurrent joins

async function loadAgoraSDK() {
  if (typeof window === 'undefined') {
    throw new Error('Agora SDK can only be loaded on the client side');
  }
  
  if (!AgoraRTC) {
    AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  }
  
  return AgoraRTC;
}

async function getClient() {
  if (typeof window === 'undefined') {
    throw new Error('Agora client can only be used on the client side');
  }

  if (!AgoraRTC) {
    await loadAgoraSDK();
  }

  if (!clientInstance) {
    clientInstance = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  }

  return clientInstance;
}

export async function joinAudioCall({
  appId,
  token,
  channelName,
  uid,
  onRemoteAudio,
  onUserLeft,
}: {
  appId: string;
  token: string;
  channelName: string;
  uid?: number;
  onRemoteAudio?: (track: any) => void;
  onUserLeft?: (uid: string | number) => void;
}) {
  if (typeof window === 'undefined') {
    throw new Error('joinAudioCall can only be called on the client side');
  }
  
  if (!appId || appId.trim() === '') {
    throw new Error('Agora App ID is required. Please set NEXT_PUBLIC_AGORA_APP_ID in your .env.local file.');
  }
  
  // Prevent concurrent joins
  if (isJoining) {
    console.warn('⚠️ Already joining Agora call, waiting...');
    // Wait for current join to complete or timeout
    let waitAttempts = 0;
    while (isJoining && waitAttempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitAttempts++;
    }
    if (isJoining) {
      console.warn('⚠️ joinAudioCall still locked; aborting duplicate join');
      return { audioTrack: null, uid: undefined };
    }
  }
  
  isJoining = true;
  
  try {
    // Load Agora SDK if not already loaded
    if (!AgoraRTC) {
      await loadAgoraSDK();
    }
    
    const agoraClient = await getClient();
    
    // Check if already connected/connecting and wait for leave to complete
    const connectionState = agoraClient.connectionState;
    if (connectionState === 'CONNECTING' || connectionState === 'CONNECTED') {
      console.warn('⚠️ Agora client already in state:', connectionState, '- leaving first');
      try {
        await agoraClient.leave();
        // Wait longer and poll for disconnected state
        let attempts = 0;
        const maxAttempts = 20; // 2 seconds max wait
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const newState = agoraClient.connectionState;
          if (newState === 'DISCONNECTED') {
            console.log('✅ Client successfully disconnected');
            break;
          }
          attempts++;
        }
        if (agoraClient.connectionState !== 'DISCONNECTED') {
          console.warn('⚠️ Client still not disconnected, creating new client instance');
          // Create a new client instance if we can't disconnect
          clientInstance = null;
        }
      } catch (leaveError) {
        console.warn('Error leaving existing connection:', leaveError);
        // Reset client and try again
        clientInstance = null;
      }
    }
    
    // Get client again (might be new instance)
    const finalClient = await getClient();
    const joinedUid = await finalClient.join(appId, channelName, token, uid || null);

    // Subscribe to remote audio and play automatically
    finalClient.on('user-published', async (user: any, mediaType: string) => {
      try {
        await finalClient.subscribe(user, mediaType);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
          if (onRemoteAudio) onRemoteAudio(user.audioTrack);
        }
      } catch (err) {
        console.error('Failed to subscribe to remote user:', err);
      }
    });

    finalClient.on('user-left', (user: any) => {
      try {
        if (user.audioTrack) {
          user.audioTrack.stop();
        }
      } catch (err) {
        console.warn('Error stopping remote track on leave:', err);
      }
      if (onUserLeft) {
        onUserLeft(user.uid);
      }
    });

    finalClient.on('user-unpublished', (user: any) => {
      if (user.audioTrack) {
        try {
          user.audioTrack.stop();
        } catch (err) {
          console.warn('Error stopping remote track:', err);
        }
      }
    });

    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    await finalClient.publish(audioTrack);

    return { audioTrack, uid: joinedUid };
  } catch (error) {
    console.error('Failed to join audio call:', error);
    throw error;
  } finally {
    isJoining = false;
  }
}

export async function leaveAudioCall(track?: any) {
  if (typeof window === 'undefined') {
    return; // Silently return on server side
  }
  
  try {
    if (track) {
      track.stop();
      track.close();
    }
  } catch (error) {
    console.error('Error stopping track:', error);
  }

  try {
    if (clientInstance) {
      await clientInstance.leave();
    }
  } catch (error) {
    console.error('Error leaving channel:', error);
  }
}
