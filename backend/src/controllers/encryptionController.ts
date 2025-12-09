import { Request, Response } from 'express';
import { SignalService } from '../services/encryption/SignalService';
import { SessionManager } from '../services/encryption/SessionManager';

type AuthRequest = Request & {
  userId?: string;
};

/**
 * Upload user's public keys (after registration)
 */
export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { identityKey, signedPreKey, oneTimePreKeys } = req.body;

    // Validate request
    if (!identityKey || !signedPreKey || !oneTimePreKeys || !Array.isArray(oneTimePreKeys)) {
      res.status(400).json({ error: 'Missing or invalid required keys' });
      return;
    }

    // Validate signed pre-key structure
    if (!signedPreKey.id || !signedPreKey.public || !signedPreKey.signature) {
      res.status(400).json({ error: 'Invalid signed pre-key structure' });
      return;
    }

    // Validate one-time pre-keys
    if (oneTimePreKeys.length === 0) {
      res.status(400).json({ error: 'At least one one-time pre-key is required' });
      return;
    }

    await SignalService.uploadPublicKeys(userId, {
      identityKey: Buffer.from(identityKey, 'base64'),
      signedPreKey: {
        keyId: signedPreKey.id,
        publicKey: Buffer.from(signedPreKey.public, 'base64'),
        signature: Buffer.from(signedPreKey.signature, 'base64')
      },
      oneTimePreKeys: oneTimePreKeys.map((k: any) => ({
        keyId: k.id,
        publicKey: Buffer.from(k.public, 'base64')
      }))
    });

    res.json({ 
      message: 'Keys uploaded successfully',
      prekeyCount: oneTimePreKeys.length
    });
  } catch (error) {
    console.error('Upload keys error:', error);
    res.status(500).json({ 
      error: 'Failed to upload keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get pre-key bundle for a user (to establish encrypted session)
 */
export const getPreKeyBundle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId!;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const bundle = await SignalService.getPreKeyBundle(userId);

    // Update used_by field if a one-time pre-key was consumed
    if (bundle.oneTimePreKey) {
      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();
      
      await supabase
        .from('used_prekeys')
        .update({ used_by: requesterId })
        .eq('user_id', userId)
        .eq('prekey_id', bundle.oneTimePreKey.id.toString());
    }

    res.json(bundle);
  } catch (error) {
    console.error('Get prekey bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to get key bundle',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Rotate signed pre-key
 */
export const rotateSignedPreKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { signedPreKey } = req.body;

    if (!signedPreKey || !signedPreKey.id || !signedPreKey.public || !signedPreKey.signature) {
      res.status(400).json({ error: 'Invalid signed pre-key structure' });
      return;
    }

    await SignalService.rotateSignedPreKey(userId, {
      keyId: signedPreKey.id,
      publicKey: Buffer.from(signedPreKey.public, 'base64'),
      signature: Buffer.from(signedPreKey.signature, 'base64')
    });

    res.json({ message: 'Signed pre-key rotated successfully' });
  } catch (error) {
    console.error('Rotate prekey error:', error);
    res.status(500).json({ 
      error: 'Failed to rotate key',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Replenish one-time pre-keys
 */
export const replenishOneTimePreKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { oneTimePreKeys } = req.body;

    if (!oneTimePreKeys || !Array.isArray(oneTimePreKeys) || oneTimePreKeys.length === 0) {
      res.status(400).json({ error: 'Invalid one-time pre-keys' });
      return;
    }

    await SignalService.replenishOneTimePreKeys(userId, oneTimePreKeys.map((k: any) => ({
      keyId: k.id,
      publicKey: Buffer.from(k.public, 'base64')
    })));

    res.json({ 
      message: 'One-time pre-keys replenished successfully',
      count: oneTimePreKeys.length
    });
  } catch (error) {
    console.error('Replenish prekeys error:', error);
    res.status(500).json({ 
      error: 'Failed to replenish keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get encryption status
 */
export const getEncryptionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const status = await SignalService.getEncryptionStatus(userId);
    const needsReplenishment = await SignalService.needsReplenishment(userId);

    res.json({
      ...status,
      needsReplenishment
    });
  } catch (error) {
    console.error('Get encryption status error:', error);
    res.status(500).json({ 
      error: 'Failed to get encryption status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Initialize session with a contact (not strictly needed server-side for E2EE, but useful for tracking)
 */
export const initializeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { contactId } = req.params;

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    // Check if session already exists
    const hasSession = await SessionManager.hasSession(userId, contactId);

    if (hasSession) {
      res.json({ 
        message: 'Session already exists',
        alreadyExists: true
      });
      return;
    }

    // Create empty session record (actual session state managed client-side)
    await SessionManager.saveSession(userId, contactId, { initialized: true });

    res.json({ 
      message: 'Session initialized successfully',
      alreadyExists: false
    });
  } catch (error) {
    console.error('Initialize session error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete session with a contact
 */
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { contactId } = req.params;

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    await SessionManager.deleteSession(userId, contactId);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ 
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get active sessions
 */
export const getActiveSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const sessions = await SessionManager.getActiveSessions(userId);

    res.json({ sessions });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ 
      error: 'Failed to get active sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
