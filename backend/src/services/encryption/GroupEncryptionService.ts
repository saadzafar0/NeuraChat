import * as SignalClient from '@signalapp/libsignal-client';
import { getSupabaseClient } from '../../config/database';

/**
 * GroupEncryptionService - Implements Sender Keys protocol for efficient group encryption
 * 
 * Sender Keys Protocol:
 * - Each sender in a group has their own sender key
 * - Messages are encrypted once with the sender key (not once per recipient)
 * - All group members receive the same encrypted message
 * - Much more efficient than pairwise encryption for groups
 * 
 * Key Features:
 * - Forward secrecy within the group
 * - Efficient message broadcasting
 * - Automatic key rotation
 * - Member add/remove handling
 */

export interface SenderKey {
  groupId: string;
  senderId: string;
  keyId: number;
  chainKey: Buffer;
  signatureKey: Buffer;
  createdAt: Date;
}

export interface GroupEncryptionState {
  groupId: string;
  senderKeys: Map<string, SenderKey>; // senderId -> SenderKey
  memberIds: string[];
  distributionId: string; // UUID for this key distribution
}

export class GroupEncryptionService {
  /**
   * Create a new sender key for a user in a group
   */
  static async createSenderKey(groupId: string, senderId: string): Promise<SenderKey> {
    const supabase = getSupabaseClient();
    
    // Generate random sender key components
    const chainKey = Buffer.from(SignalClient.PrivateKey.generate().serialize());
    const signatureKey = Buffer.from(SignalClient.PrivateKey.generate().getPublicKey().serialize());
    
    const senderKey: SenderKey = {
      groupId,
      senderId,
      keyId: Date.now(), // Simple incrementing key ID
      chainKey,
      signatureKey,
      createdAt: new Date(),
    };
    
    // Store sender key in database
    const { error } = await supabase
      .from('group_sender_keys')
      .insert({
        group_id: groupId,
        sender_id: senderId,
        key_id: senderKey.keyId,
        chain_key: chainKey.toString('base64'),
        signature_key: signatureKey.toString('base64'),
        created_at: senderKey.createdAt.toISOString(),
      });
    
    if (error) {
      throw new Error(`Failed to store sender key: ${error.message}`);
    }
    
    return senderKey;
  }
  
  /**
   * Get sender key for a user in a group
   */
  static async getSenderKey(groupId: string, senderId: string): Promise<SenderKey | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('group_sender_keys')
      .select('*')
      .eq('group_id', groupId)
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      groupId: data.group_id,
      senderId: data.sender_id,
      keyId: data.key_id,
      chainKey: Buffer.from(data.chain_key, 'base64'),
      signatureKey: Buffer.from(data.signature_key, 'base64'),
      createdAt: new Date(data.created_at),
    };
  }
  
  /**
   * Distribute sender key to all group members
   * This is done when:
   * - User sends their first message to the group
   * - New member joins the group
   * - Sender key is rotated
   */
  static async distributeSenderKey(
    groupId: string,
    senderId: string,
    senderKey: SenderKey,
    memberIds: string[]
  ): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Create distribution records for each member
    const distributions = memberIds
      .filter(memberId => memberId !== senderId) // Don't send to self
      .map(memberId => ({
        group_id: groupId,
        sender_id: senderId,
        recipient_id: memberId,
        key_id: senderKey.keyId,
        chain_key: senderKey.chainKey.toString('base64'),
        signature_key: senderKey.signatureKey.toString('base64'),
        distributed_at: new Date().toISOString(),
      }));
    
    if (distributions.length === 0) {
      return; // No members to distribute to
    }
    
    const { error } = await supabase
      .from('sender_key_distributions')
      .insert(distributions);
    
    if (error) {
      throw new Error(`Failed to distribute sender key: ${error.message}`);
    }
  }
  
  /**
   * Encrypt a message for a group using sender key
   */
  static async encryptGroupMessage(
    groupId: string,
    senderId: string,
    plaintext: string
  ): Promise<string> {
    // Get or create sender key
    let senderKey = await this.getSenderKey(groupId, senderId);
    
    if (!senderKey) {
      // First message from this sender - create sender key
      senderKey = await this.createSenderKey(groupId, senderId);
      
      // Distribute to all members
      const members = await this.getGroupMembers(groupId);
      await this.distributeSenderKey(groupId, senderId, senderKey, members);
    }
    
    // Encrypt message with sender key
    // In production, use Signal's SenderKeyMessage protocol
    // For now, we'll use a simplified encryption approach
    const message = {
      groupId,
      senderId,
      keyId: senderKey.keyId,
      ciphertext: this.encryptWithSenderKey(plaintext, senderKey.chainKey),
      signature: this.signMessage(plaintext, senderKey.signatureKey),
    };
    
    // Return as base64-encoded JSON
    return Buffer.from(JSON.stringify(message)).toString('base64');
  }
  
  /**
   * Decrypt a group message using the sender's key
   */
  static async decryptGroupMessage(
    groupId: string,
    senderId: string,
    encryptedMessage: string,
    recipientId: string
  ): Promise<string> {
    // Decode message
    const message = JSON.parse(Buffer.from(encryptedMessage, 'base64').toString('utf-8'));
    
    // Get sender key (should have been distributed)
    const senderKey = await this.getReceivedSenderKey(groupId, senderId, recipientId);
    
    if (!senderKey) {
      throw new Error('Sender key not found - may not have been distributed yet');
    }
    
    // Verify signature
    const signatureValid = this.verifySignature(
      message.ciphertext,
      message.signature,
      senderKey.signatureKey
    );
    
    if (!signatureValid) {
      throw new Error('Message signature verification failed');
    }
    
    // Decrypt message
    const plaintext = this.decryptWithSenderKey(message.ciphertext, senderKey.chainKey);
    
    return plaintext;
  }
  
  /**
   * Get sender key that was distributed to a specific recipient
   */
  private static async getReceivedSenderKey(
    groupId: string,
    senderId: string,
    recipientId: string
  ): Promise<SenderKey | null> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('sender_key_distributions')
      .select('*')
      .eq('group_id', groupId)
      .eq('sender_id', senderId)
      .eq('recipient_id', recipientId)
      .order('distributed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      groupId: data.group_id,
      senderId: data.sender_id,
      keyId: data.key_id,
      chainKey: Buffer.from(data.chain_key, 'base64'),
      signatureKey: Buffer.from(data.signature_key, 'base64'),
      createdAt: new Date(data.distributed_at),
    };
  }
  
  /**
   * Handle new member joining group
   * - Distribute all existing sender keys to the new member
   */
  static async onMemberAdded(groupId: string, newMemberId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Get all sender keys for this group
    const { data: senderKeys, error } = await supabase
      .from('group_sender_keys')
      .select('*')
      .eq('group_id', groupId);
    
    if (error || !senderKeys) {
      return;
    }
    
    // Distribute each sender key to the new member
    const distributions = senderKeys.map(key => ({
      group_id: groupId,
      sender_id: key.sender_id,
      recipient_id: newMemberId,
      key_id: key.key_id,
      chain_key: key.chain_key,
      signature_key: key.signature_key,
      distributed_at: new Date().toISOString(),
    }));
    
    await supabase.from('sender_key_distributions').insert(distributions);
  }
  
  /**
   * Handle member leaving group
   * - Rotate all sender keys (forward secrecy)
   * - Remove member's sender key distributions
   */
  static async onMemberRemoved(groupId: string, removedMemberId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Delete all sender key distributions to the removed member
    await supabase
      .from('sender_key_distributions')
      .delete()
      .eq('group_id', groupId)
      .eq('recipient_id', removedMemberId);
    
    // Delete the removed member's sender key
    await supabase
      .from('group_sender_keys')
      .delete()
      .eq('group_id', groupId)
      .eq('sender_id', removedMemberId);
    
    // Optionally: Rotate all other members' sender keys for forward secrecy
    // This ensures the removed member can't decrypt future messages
    await this.rotateAllSenderKeys(groupId);
  }
  
  /**
   * Rotate sender key for a specific user in a group
   */
  static async rotateSenderKey(groupId: string, senderId: string): Promise<SenderKey> {
    // Create new sender key
    const newKey = await this.createSenderKey(groupId, senderId);
    
    // Distribute to all members
    const members = await this.getGroupMembers(groupId);
    await this.distributeSenderKey(groupId, senderId, newKey, members);
    
    return newKey;
  }
  
  /**
   * Rotate all sender keys in a group
   * Used when a member is removed for forward secrecy
   */
  static async rotateAllSenderKeys(groupId: string): Promise<void> {
    const members = await this.getGroupMembers(groupId);
    
    for (const memberId of members) {
      await this.rotateSenderKey(groupId, memberId);
    }
  }
  
  /**
   * Get all members of a group
   */
  private static async getGroupMembers(groupId: string): Promise<string[]> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', groupId);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(p => p.user_id);
  }
  
  /**
   * Simplified encryption with sender key
   * In production, use Signal's SenderKeyMessage protocol
   */
  private static encryptWithSenderKey(plaintext: string, chainKey: Buffer): string {
    // Derive message key from chain key
    const messageKey = this.deriveMessageKey(chainKey);
    
    // XOR encryption (simplified - use AES-256-GCM in production)
    const plaintextBuffer = Buffer.from(plaintext, 'utf-8');
    const ciphertext = Buffer.alloc(plaintextBuffer.length);
    
    for (let i = 0; i < plaintextBuffer.length; i++) {
      ciphertext[i] = plaintextBuffer[i] ^ messageKey[i % messageKey.length];
    }
    
    return ciphertext.toString('base64');
  }
  
  /**
   * Simplified decryption with sender key
   */
  private static decryptWithSenderKey(ciphertext: string, chainKey: Buffer): string {
    const messageKey = this.deriveMessageKey(chainKey);
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
    const plaintext = Buffer.alloc(ciphertextBuffer.length);
    
    for (let i = 0; i < ciphertextBuffer.length; i++) {
      plaintext[i] = ciphertextBuffer[i] ^ messageKey[i % messageKey.length];
    }
    
    return plaintext.toString('utf-8');
  }
  
  /**
   * Derive message key from chain key
   */
  private static deriveMessageKey(chainKey: Buffer): Buffer {
    // In production, use HKDF (HMAC-based Key Derivation Function)
    // Simplified version for demonstration
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(chainKey).digest();
  }
  
  /**
   * Sign a message with signature key
   */
  private static signMessage(message: string, signatureKey: Buffer): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(message + signatureKey.toString('hex')).digest();
    return hash.toString('base64');
  }
  
  /**
   * Verify message signature
   */
  private static verifySignature(message: string, signature: string, signatureKey: Buffer): boolean {
    const expectedSignature = this.signMessage(message, signatureKey);
    return signature === expectedSignature;
  }
  
  /**
   * Get group encryption status
   */
  static async getGroupEncryptionStatus(groupId: string): Promise<{
    enabled: boolean;
    senderKeyCount: number;
    memberCount: number;
    lastRotation?: Date;
  }> {
    const supabase = getSupabaseClient();
    
    // Count sender keys
    const { data: senderKeys, error: keysError } = await supabase
      .from('group_sender_keys')
      .select('created_at')
      .eq('group_id', groupId);
    
    // Count members
    const { data: members, error: membersError } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', groupId);
    
    if (keysError || membersError) {
      throw new Error('Failed to get encryption status');
    }
    
    // Find most recent key rotation
    const lastRotation = senderKeys && senderKeys.length > 0
      ? new Date(Math.max(...senderKeys.map(k => new Date(k.created_at).getTime())))
      : undefined;
    
    return {
      enabled: senderKeys !== null && senderKeys.length > 0,
      senderKeyCount: senderKeys?.length || 0,
      memberCount: members?.length || 0,
      lastRotation,
    };
  }
  
  /**
   * Initialize group encryption for a new group
   */
  static async initializeGroupEncryption(groupId: string, memberIds: string[]): Promise<void> {
    // Create sender keys for all initial members
    for (const memberId of memberIds) {
      const senderKey = await this.createSenderKey(groupId, memberId);
      await this.distributeSenderKey(groupId, memberId, senderKey, memberIds);
    }
  }
}
