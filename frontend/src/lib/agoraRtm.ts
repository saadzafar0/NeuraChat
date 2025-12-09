'use client';

import { useEffect } from 'react';
import api from '@/lib/api';

let AgoraRTM: any = null;
let connectPromise: Promise<any> | null = null;

async function loadRtmSdk() {
  if (typeof window === 'undefined') throw new Error('RTM only on client');
  if (!AgoraRTM) {
    AgoraRTM = (await import('agora-rtm-sdk')).default;
  }
  return AgoraRTM;
}

class RtmClient {
  private client: any = null;
  private isReady = false;
  private tokenFetcher: (() => Promise<string>) | null = null;
  private appId?: string;
  private userId?: string;

  private async renewToken() {
    if (!this.client || !this.tokenFetcher) return;
    try {
      const fresh = await this.tokenFetcher();
      await this.client.renewToken(fresh);
    } catch (err) {
      console.error('RTM renew token failed', err);
      this.isReady = false;
      this.client = null;
    }
  }

  private async ensureReady() {
    if (this.client && this.isReady) return;
    if (!this.appId || !this.userId) {
      throw new Error('RTM client not initialized');
    }
    const fresh = this.tokenFetcher ? await this.tokenFetcher() : undefined;
    await this.connect(this.appId, this.userId, fresh, this.tokenFetcher || undefined);
  }

  async connect(appId: string, userId: string, token?: string, tokenFetcher?: () => Promise<string>) {
    const SDK = await loadRtmSdk();
    if (!this.client) {
      this.client = SDK.createInstance(appId);
    }
    this.appId = appId;
    this.userId = userId;
    this.tokenFetcher = tokenFetcher || null;
    if (!this.isReady) {
      // Deduplicate concurrent login attempts
      if (!connectPromise) {
        connectPromise = this.client
          .login({ uid: userId, token: token || undefined })
          .then(() => {
            this.isReady = true;
          })
          .catch((err: any) => {
            this.isReady = false;
            throw err;
          })
          .finally(() => {
            connectPromise = null;
          });
      }
      await connectPromise;
      if (this.client) {
        this.client.on('TokenPrivilegeWillExpire', () => this.renewToken());
        this.client.on('TokenPrivilegeDidExpire', async () => {
          await this.renewToken();
          if (!this.isReady && this.tokenFetcher) {
            const fresh = await this.tokenFetcher();
            await this.connect(appId, userId, fresh, this.tokenFetcher);
          }
        });
      }
    }
    return this.client;
  }

  onMessage(handler: (from: string, payload: any) => void) {
    if (!this.client) return;
    this.client.on('MessageFromPeer', (message: any, peerId: string) => {
      try {
        const data = JSON.parse(message.text || '{}');
        handler(peerId, data);
      } catch (err) {
        console.warn('RTM message parse error', err);
      }
    });
  }

  async send(toUserId: string, payload: any) {
    if (!this.client || !this.isReady) {
      await this.ensureReady();
    }
    await this.client.sendMessageToPeer({ text: JSON.stringify(payload) }, toUserId);
  }

  async disconnect() {
    if (this.client && this.isReady) {
      await this.client.logout();
      this.isReady = false;
    }
    this.client = null;
  }
}

export const rtmClient = new RtmClient();

// Optional helper hook to auto-disconnect on unmount
export function useRtmAutoDisconnect(appId: string, userId?: string) {
  useEffect(() => {
    return () => {
      rtmClient.disconnect().catch(() => {});
    };
  }, [appId, userId]);
}

