'use client';

// Dynamic import to avoid SSR issues - Agora SDK is only loaded on client side
let AgoraRTC: any = null;
let clientInstance: any = null;
let isJoining = false; // Global lock to prevent concurrent joins
let activeLocalTracks: any[] = []; // Track all active local tracks

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

// Release all active local tracks
async function releaseAllLocalTracks() {
  if (typeof window === 'undefined') return;
  
  for (const track of activeLocalTracks) {
    try {
      if (track) {
        track.stop();
        track.close();
      }
    } catch (err) {
      console.warn('Error releasing track:', err);
    }
  }
  activeLocalTracks = [];
}

// Unpublish all tracks from client
async function unpublishAllTracks(client: any) {
  if (!client) return;
  
  try {
    const localTracks = client.localTracks || [];
    for (const track of localTracks) {
      try {
        await client.unpublish(track);
      } catch (err) {
        console.warn('Error unpublishing track:', err);
      }
    }
  } catch (err) {
    console.warn('Error getting local tracks:', err);
  }
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
      console.warn('⚠️ Agora client already in state:', connectionState, '- cleaning up first');
      try {
        // Unpublish all tracks first
        await unpublishAllTracks(agoraClient);
        // Release all local tracks
        await releaseAllLocalTracks();
        // Then leave
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
        // Force release tracks even if leave fails
        await releaseAllLocalTracks();
        // Reset client and try again
        clientInstance = null;
      }
    } else {
      // Even if not connected, release any orphaned tracks
      await releaseAllLocalTracks();
    }
    
    // Get client again (might be new instance)
    const finalClient = await getClient();
    
    // Ensure all previous tracks are released before joining
    await releaseAllLocalTracks();
    
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

    // Release any existing tracks before creating new ones
    await releaseAllLocalTracks();
    
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    activeLocalTracks = [audioTrack];
    await finalClient.publish(audioTrack);

    return { audioTrack, uid: joinedUid };
  } catch (error) {
    console.error('Failed to join audio call:', error);
    throw error;
  } finally {
    isJoining = false;
  }
}

export async function joinVideoCall({
  appId,
  token,
  channelName,
  uid,
  onRemoteVideo,
  onRemoteAudio,
  onUserLeft,
  localVideoElement,
}: {
  appId: string;
  token: string;
  channelName: string;
  uid?: number;
  onRemoteVideo?: (track: any, uid: number) => void;
  onRemoteAudio?: (track: any) => void;
  onUserLeft?: (uid: string | number) => void;
  localVideoElement?: HTMLVideoElement | null;
}) {
  if (typeof window === 'undefined') {
    throw new Error('joinVideoCall can only be called on the client side');
  }
  
  if (!appId || appId.trim() === '') {
    throw new Error('Agora App ID is required. Please set NEXT_PUBLIC_AGORA_APP_ID in your .env.local file.');
  }
  
  // Prevent concurrent joins
  if (isJoining) {
    console.warn('⚠️ Already joining Agora call, waiting...');
    let waitAttempts = 0;
    while (isJoining && waitAttempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitAttempts++;
    }
    if (isJoining) {
      console.warn('⚠️ joinVideoCall still locked; aborting duplicate join');
      return { audioTrack: null, videoTrack: null, uid: undefined };
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
      console.warn('⚠️ Agora client already in state:', connectionState, '- cleaning up first');
      try {
        // Unpublish all tracks first
        await unpublishAllTracks(agoraClient);
        // Release all local tracks
        await releaseAllLocalTracks();
        // Then leave
        await agoraClient.leave();
        let attempts = 0;
        const maxAttempts = 20;
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
          clientInstance = null;
        }
      } catch (leaveError) {
        console.warn('Error leaving existing connection:', leaveError);
        // Force release tracks even if leave fails
        await releaseAllLocalTracks();
        clientInstance = null;
      }
    } else {
      // Even if not connected, release any orphaned tracks
      await releaseAllLocalTracks();
    }
    
    // Get client again (might be new instance)
    const finalClient = await getClient();
    const joinedUid = await finalClient.join(appId, channelName, token, uid || null);

    // Subscribe to remote media
    finalClient.on('user-published', async (user: any, mediaType: string) => {
      try {
        // Check if user object is valid before subscribing
        if (!user || typeof user !== 'object') {
          console.warn('Invalid user object in user-published event:', user);
          return;
        }
        
        // Check connection state before subscribing
        if (finalClient.connectionState !== 'CONNECTED') {
          console.warn('Cannot subscribe - client not connected. State:', finalClient.connectionState);
          // Wait a bit and retry if connecting
          if (finalClient.connectionState === 'CONNECTING') {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (finalClient.connectionState !== 'CONNECTED') {
              console.warn('Still not connected after wait, skipping subscribe');
              return;
            }
          } else {
            return;
          }
        }
        
        await finalClient.subscribe(user, mediaType);
        if (mediaType === 'video' && user.videoTrack) {
          if (onRemoteVideo) onRemoteVideo(user.videoTrack, user.uid);
        }
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
          if (onRemoteAudio) onRemoteAudio(user.audioTrack);
        }
      } catch (err: any) {
        // Handle specific subscription errors
        if (err?.code === 'INVALID_OPERATION' && err?.message?.includes('disconnected')) {
          console.warn('Cannot subscribe - peer connection disconnected. This may be temporary.');
        } else {
          console.error('Failed to subscribe to remote user:', err);
        }
      }
    });

    finalClient.on('user-left', (user: any) => {
      try {
        if (user.videoTrack) {
          user.videoTrack.stop();
        }
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
      if (user.videoTrack) {
        try {
          user.videoTrack.stop();
        } catch (err) {
          console.warn('Error stopping remote video track:', err);
        }
      }
      if (user.audioTrack) {
        try {
          user.audioTrack.stop();
        } catch (err) {
          console.warn('Error stopping remote audio track:', err);
        }
      }
    });

    // Release any existing tracks before creating new ones
    await releaseAllLocalTracks();
    
    // Create and publish local tracks
    let audioTrack: any = null;
    let videoTrack: any = null;
    let tracksCreated = false;
    
    try {
      [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      // Track the new tracks
      activeLocalTracks = [audioTrack, videoTrack].filter(Boolean);
      tracksCreated = true;
      console.log('✅ Successfully created audio and video tracks');
    } catch (error: any) {
      // Handle permission denied or other errors
      if (error?.code === 'PERMISSION_DENIED' || error?.name === 'NotAllowedError') {
        throw new Error('Camera and microphone permissions are required for video calls. Please grant permissions and try again.');
      }
      // Handle device in use error - allow receive-only mode for testing
      if (error?.code === 'NOT_READABLE' || error?.name === 'NotReadableError' || error?.message?.includes('Device in use')) {
        console.warn('⚠️ Device in use - this is expected when testing on the same device with multiple browsers');
        console.log('ℹ️ Joining call in receive-only mode - you can still see and hear the other participant');
        
        // Don't retry - immediately join in receive-only mode
        // This allows both browsers to join the call, even if only one can send video
        audioTrack = null;
        videoTrack = null;
        activeLocalTracks = [];
        tracksCreated = false;
        
        // Log a helpful message
        console.log('✅ Proceeding with receive-only mode - remote video/audio will still work');
      } else {
        throw error;
      }
    }
    
    // Play local video if element provided (optional - can be played later in component)
    if (localVideoElement && videoTrack) {
      try {
        const playPromise = videoTrack.play(localVideoElement);
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.warn('Error playing local video on provided element:', err);
          });
        }
      } catch (err) {
        console.warn('Error playing local video on provided element:', err);
      }
    }
    
    // Only publish tracks that were successfully created
    const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) {
      try {
        await finalClient.publish(tracksToPublish);
        console.log(`✅ Published ${tracksToPublish.length} local track(s)`);
      } catch (publishError) {
        console.warn('⚠️ Failed to publish tracks, but continuing in receive-only mode:', publishError);
      }
    } else {
      console.log('ℹ️ No local tracks to publish - joining in receive-only mode (can still receive remote video/audio)');
    }

    // Always return, even if tracks are null - this allows receive-only mode
    return { audioTrack: audioTrack || null, videoTrack: videoTrack || null, uid: joinedUid };
  } catch (error) {
    console.error('Failed to join video call:', error);
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
    if (clientInstance) {
      // Unpublish all tracks first
      await unpublishAllTracks(clientInstance);
      await clientInstance.leave();
    }
  } catch (error) {
    console.error('Error leaving channel:', error);
  }
  
  try {
    if (track) {
      track.stop();
      track.close();
    }
    // Release all local tracks
    await releaseAllLocalTracks();
  } catch (error) {
    console.error('Error stopping track:', error);
  }
}

export async function leaveVideoCall(audioTrack?: any, videoTrack?: any) {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    if (clientInstance) {
      // Unpublish all tracks first
      await unpublishAllTracks(clientInstance);
      await clientInstance.leave();
    }
  } catch (error) {
    console.error('Error leaving channel:', error);
  }
  
  try {
    if (audioTrack) {
      audioTrack.stop();
      audioTrack.close();
    }
    if (videoTrack) {
      videoTrack.stop();
      videoTrack.close();
    }
    // Release all local tracks (including any orphaned ones)
    await releaseAllLocalTracks();
  } catch (error) {
    console.error('Error stopping tracks:', error);
  }
}
