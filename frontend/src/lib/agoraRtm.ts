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
  private connectionAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds

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

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async connect(appId: string, userId: string, token?: string, tokenFetcher?: () => Promise<string>, retryCount = 0): Promise<any> {
    const SDK = await loadRtmSdk();
    
    // Reset client if previous connection failed
    if (this.client && !this.isReady) {
      try {
        await this.client.logout().catch(() => {});
      } catch {}
      this.client = null;
    }

    if (!this.client) {
      try {
        // Create RTM instance with optional configuration
        this.client = SDK.createInstance(appId, {
          // Add timeout configuration if available
          // logFilter: SDK.LogFilter.ERROR, // Reduce log noise
        });
      } catch (err) {
        console.error('Failed to create RTM instance:', err);
        throw err;
      }
    }

    this.appId = appId;
    this.userId = userId;
    this.tokenFetcher = tokenFetcher || null;

    if (!this.isReady) {
      // Deduplicate concurrent login attempts
      if (!connectPromise) {
        connectPromise = (async () => {
          try {
            console.log(`[RTM] Attempting to connect (attempt ${retryCount + 1}/${this.maxRetries + 1})...`);
            
            // Set up timeout for login
            const loginPromise = this.client.login({ 
              uid: userId, 
              token: token || undefined 
            });

            // Add timeout wrapper (RTM SDK has its own timeout, but we add extra safety)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error('RTM login timeout after 15 seconds'));
              }, 15000);
            });

            await Promise.race([loginPromise, timeoutPromise]);
            
            this.isReady = true;
            this.connectionAttempts = 0;
            console.log('[RTM] Successfully connected');
            
            // Set up event listeners
            if (this.client) {
              this.client.on('TokenPrivilegeWillExpire', () => {
                console.log('[RTM] Token will expire, renewing...');
                this.renewToken();
              });
              
              this.client.on('TokenPrivilegeDidExpire', async () => {
                console.log('[RTM] Token expired, renewing...');
                await this.renewToken();
                if (!this.isReady && this.tokenFetcher) {
                  const fresh = await this.tokenFetcher();
                  await this.connect(appId, userId, fresh, this.tokenFetcher, 0);
                }
              });

              this.client.on('ConnectionStateChanged', (newState: string, reason: string) => {
                console.log(`[RTM] Connection state changed: ${newState}, reason: ${reason}`);
                if (newState === 'DISCONNECTED' || newState === 'ABORTED') {
                  this.isReady = false;
                }
              });
            }

            return this.client;
          } catch (err: any) {
            this.isReady = false;
            this.connectionAttempts++;
            
            console.error(`[RTM] Connection failed (attempt ${retryCount + 1}):`, err);
            
            // Retry logic with exponential backoff
            if (retryCount < this.maxRetries && (
              err?.code === 9 || // TIMEOUT
              err?.message?.includes('timeout') ||
              err?.message?.includes('TIMEOUT')
            )) {
              const delay = this.retryDelay * Math.pow(2, retryCount);
              console.log(`[RTM] Retrying in ${delay}ms...`);
              await this.sleep(delay);
              
              // Get fresh token for retry
              const freshToken = tokenFetcher ? await tokenFetcher() : token;
              return this.connect(appId, userId, freshToken, tokenFetcher, retryCount + 1);
            }
            
            throw err;
          } finally {
            connectPromise = null;
          }
        })();
      }
      
      try {
        return await connectPromise;
      } catch (err) {
        // If all retries failed, log but don't block the app
        console.warn('[RTM] All connection attempts failed. Call signaling will use Socket.IO only.');
        throw err;
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
      try {
        await this.ensureReady();
      } catch (err) {
        console.warn('[RTM] Cannot send message - RTM not connected:', err);
        throw new Error('RTM connection not available. Please check your network connection.');
      }
    }
    
    try {
      await this.client.sendMessageToPeer({ text: JSON.stringify(payload) }, toUserId);
    } catch (err: any) {
      console.error('[RTM] Failed to send message:', err);
      // If RTM fails, we could fall back to Socket.IO, but for now just throw
      throw err;
    }
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

