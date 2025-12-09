import * as SignalClient from '@signalapp/libsignal-client';
import { getSupabaseClient } from '../../config/database';

export interface PreKeyBundle {
  identityKey: string;
  signedPreKey: {
    id: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKey?: {
    id: number;
    publicKey: string;
  } | null;
}

export interface KeyPair {
  privateKey: Buffer;
  publicKey: Buffer;
}

export interface SignedPreKey {
  keyId: number;
  publicKey: Buffer;
  privateKey: Buffer;
  signature: Buffer;
}

export interface OneTimePreKey {
  keyId: number;
  publicKey: Buffer;
  privateKey: Buffer;
}

export class SignalService {
  /**
   * Generate a new identity key pair for a user
   */
  static generateIdentityKeyPair(): KeyPair {
    const keyPair = SignalClient.PrivateKey.generate();
    return {
      privateKey: Buffer.from(keyPair.serialize()),
      publicKey: Buffer.from(keyPair.getPublicKey().serialize())
    };
  }

  /**
   * Generate signed pre-key
   */
  static generateSignedPreKey(identityPrivateKey: Buffer, signedPreKeyId: number): SignedPreKey {
    const privateKey = SignalClient.PrivateKey.deserialize(identityPrivateKey);
    const keyPair = SignalClient.PrivateKey.generate();
    
    const signature = privateKey.sign(keyPair.getPublicKey().serialize());
    
    return {
      keyId: signedPreKeyId,
      publicKey: Buffer.from(keyPair.getPublicKey().serialize()),
      privateKey: Buffer.from(keyPair.serialize()),
      signature: Buffer.from(signature)
    };
  }

  /**
   * Generate batch of one-time pre-keys
   */
  static generateOneTimePreKeys(startId: number, count: number): OneTimePreKey[] {
    const preKeys: OneTimePreKey[] = [];
    for (let i = 0; i < count; i++) {
      const keyPair = SignalClient.PrivateKey.generate();
      preKeys.push({
        keyId: startId + i,
        publicKey: Buffer.from(keyPair.getPublicKey().serialize()),
        privateKey: Buffer.from(keyPair.serialize())
      });
    }
    return preKeys;
  }

  /**
   * Upload user's public keys to server
   */
  static async uploadPublicKeys(userId: string, keys: {
    identityKey: Buffer;
    signedPreKey: { keyId: number; publicKey: Buffer; signature: Buffer };
    oneTimePreKeys: { keyId: number; publicKey: Buffer }[];
  }): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Check if user already has keys
    const { data: existingKeys } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('user_id', userId)
      .single();

    const keyData = {
      user_id: userId,
      identity_key: keys.identityKey.toString('base64'),
      signed_pre_key: JSON.stringify({
        id: keys.signedPreKey.keyId,
        public: keys.signedPreKey.publicKey.toString('base64'),
        signature: keys.signedPreKey.signature.toString('base64')
      }),
      one_time_pre_keys: keys.oneTimePreKeys.map(k => ({
        id: k.keyId,
        public: k.publicKey.toString('base64')
      })),
      updated_at: new Date().toISOString()
    };

    const { error } = existingKeys
      ? await supabase.from('encryption_keys').update(keyData).eq('user_id', userId)
      : await supabase.from('encryption_keys').insert(keyData);
    
    if (error) throw new Error(`Failed to upload keys: ${error.message}`);
  }

  /**
   * Get pre-key bundle for establishing session
   */
  static async getPreKeyBundle(userId: string): Promise<PreKeyBundle> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) throw new Error('User keys not found');
    
    // Pop one one-time pre-key (FIFO)
    const oneTimePreKeys = (data.one_time_pre_keys as any[]) || [];
    const oneTimePreKey = oneTimePreKeys.length > 0 ? oneTimePreKeys.shift() : null;
    
    // Update remaining keys if we consumed one
    if (oneTimePreKey && oneTimePreKeys.length !== (data.one_time_pre_keys as any[]).length) {
      await supabase
        .from('encryption_keys')
        .update({ one_time_pre_keys: oneTimePreKeys })
        .eq('user_id', userId);

      // Log the used pre-key
      await supabase
        .from('used_prekeys')
        .insert({
          user_id: userId,
          prekey_id: oneTimePreKey.id.toString(),
          used_by: userId, // Will be updated by the requester
          used_at: new Date().toISOString()
        });
    }
    
    const signedPreKey = JSON.parse(data.signed_pre_key);
    
    return {
      identityKey: data.identity_key,
      signedPreKey: {
        id: signedPreKey.id,
        publicKey: signedPreKey.public,
        signature: signedPreKey.signature
      },
      oneTimePreKey: oneTimePreKey ? {
        id: oneTimePreKey.id,
        publicKey: oneTimePreKey.public
      } : null
    };
  }

  /**
   * Replenish one-time pre-keys
   */
  static async replenishOneTimePreKeys(userId: string, newKeys: { keyId: number; publicKey: Buffer }[]): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('one_time_pre_keys')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) throw new Error('User keys not found');
    
    const existingKeys = (data.one_time_pre_keys as any[]) || [];
    const updatedKeys = [
      ...existingKeys,
      ...newKeys.map(k => ({
        id: k.keyId,
        public: k.publicKey.toString('base64')
      }))
    ];
    
    const { error: updateError } = await supabase
      .from('encryption_keys')
      .update({ 
        one_time_pre_keys: updatedKeys,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (updateError) throw new Error(`Failed to replenish keys: ${updateError.message}`);
  }

  /**
   * Rotate signed pre-key
   */
  static async rotateSignedPreKey(userId: string, newSignedPreKey: { keyId: number; publicKey: Buffer; signature: Buffer }): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('encryption_keys')
      .update({
        signed_pre_key: JSON.stringify({
          id: newSignedPreKey.keyId,
          public: newSignedPreKey.publicKey.toString('base64'),
          signature: newSignedPreKey.signature.toString('base64')
        }),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (error) throw new Error(`Failed to rotate signed pre-key: ${error.message}`);

    // Log rotation
    await supabase
      .from('key_rotation_logs')
      .insert({
        user_id: userId,
        key_type: 'signed_pre_key',
        rotated_at: new Date().toISOString(),
        reason: 'manual'
      });
  }

  /**
   * Get encryption status for a user
   */
  static async getEncryptionStatus(userId: string): Promise<{
    hasKeys: boolean;
    prekeyCount: number;
    lastRotation?: string;
  }> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('one_time_pre_keys, updated_at')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return {
        hasKeys: false,
        prekeyCount: 0
      };
    }
    
    const oneTimePreKeys = (data.one_time_pre_keys as any[]) || [];
    
    return {
      hasKeys: true,
      prekeyCount: oneTimePreKeys.length,
      lastRotation: data.updated_at
    };
  }

  /**
   * Check if user needs to replenish pre-keys
   */
  static async needsReplenishment(userId: string, threshold: number = 20): Promise<boolean> {
    const status = await this.getEncryptionStatus(userId);
    return status.hasKeys && status.prekeyCount < threshold;
  }
}
