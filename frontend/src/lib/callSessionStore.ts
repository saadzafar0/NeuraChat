'use client';

type CallState = 'idle' | 'calling' | 'ringing' | 'in-call' | 'rejected';

type CurrentCall = {
  callId: string;
  chatId: string;
  channelName: string;
  toUserId?: string;
  toUserName?: string;
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string | null;
  isCaller: boolean;
  callType?: 'audio' | 'video';
  audioTrack?: any;
  videoTrack?: any;
  uid?: number;
};

type StoreState = {
  callState: CallState;
  currentCall: CurrentCall | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerMuted: boolean;
  callStartedAt: number | null;
  remoteTracks: any[];
  remoteVideoTracks: Map<number, any>;
  isCallUiMinimized: boolean;
};

type Listener = (state: StoreState) => void;

const initialState: StoreState = {
  callState: 'idle',
  currentCall: null,
  isMuted: false,
  isCameraOff: false,
  isSpeakerMuted: false,
  callStartedAt: null,
  remoteTracks: [],
  remoteVideoTracks: new Map(),
  isCallUiMinimized: false,
};

class CallSessionStore {
  private state: StoreState = { ...initialState };
  private listeners: Listener[] = [];

  getState() {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    const snapshot = this.state;
    this.listeners.forEach((l) => l(snapshot));
  }

  update(partial: Partial<StoreState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  reset() {
    this.state = { ...initialState };
    this.emit();
  }
}

const globalAny: any = globalThis as any;
// Preserve across Fast Refresh/HMR
if (!globalAny.__NC_CALL_SESSION_STORE__) {
  globalAny.__NC_CALL_SESSION_STORE__ = new CallSessionStore();
}

export const callSessionStore: CallSessionStore = globalAny.__NC_CALL_SESSION_STORE__;

