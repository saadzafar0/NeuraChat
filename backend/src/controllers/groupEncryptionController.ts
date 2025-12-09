import { Request, Response } from 'express';
import { GroupEncryptionService } from '../services/encryption/GroupEncryptionService';

type AuthRequest = Request & {
  userId?: string;
};

/**
 * Initialize group encryption (when creating a group)
 */
export const initializeGroupEncryption = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, memberIds } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!groupId || !memberIds || !Array.isArray(memberIds)) {
      res.status(400).json({ error: 'groupId and memberIds array are required' });
      return;
    }

    await GroupEncryptionService.initializeGroupEncryption(groupId, memberIds);

    res.status(200).json({
      message: 'Group encryption initialized successfully',
      groupId,
      memberCount: memberIds.length,
    });
  } catch (error: any) {
    console.error('Initialize group encryption error:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize group encryption' });
  }
};

/**
 * Get group encryption status
 */
export const getGroupEncryptionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = await GroupEncryptionService.getGroupEncryptionStatus(groupId);

    res.status(200).json(status);
  } catch (error: any) {
    console.error('Get group encryption status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get encryption status' });
  }
};

/**
 * Rotate sender key for current user in a group
 */
export const rotateSenderKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const newKey = await GroupEncryptionService.rotateSenderKey(groupId, userId);

    res.status(200).json({
      message: 'Sender key rotated successfully',
      keyId: newKey.keyId,
      rotatedAt: newKey.createdAt,
    });
  } catch (error: any) {
    console.error('Rotate sender key error:', error);
    res.status(500).json({ error: error.message || 'Failed to rotate sender key' });
  }
};

/**
 * Handle member added to group
 */
export const onMemberAdded = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, newMemberId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!groupId || !newMemberId) {
      res.status(400).json({ error: 'groupId and newMemberId are required' });
      return;
    }

    await GroupEncryptionService.onMemberAdded(groupId, newMemberId);

    res.status(200).json({
      message: 'Member added to group encryption',
      groupId,
      memberId: newMemberId,
    });
  } catch (error: any) {
    console.error('On member added error:', error);
    res.status(500).json({ error: error.message || 'Failed to add member to encryption' });
  }
};

/**
 * Handle member removed from group
 */
export const onMemberRemoved = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, removedMemberId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!groupId || !removedMemberId) {
      res.status(400).json({ error: 'groupId and removedMemberId are required' });
      return;
    }

    await GroupEncryptionService.onMemberRemoved(groupId, removedMemberId);

    res.status(200).json({
      message: 'Member removed from group encryption',
      groupId,
      memberId: removedMemberId,
    });
  } catch (error: any) {
    console.error('On member removed error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove member from encryption' });
  }
};

/**
 * Encrypt a group message (for testing purposes)
 */
export const encryptGroupMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, plaintext } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!groupId || !plaintext) {
      res.status(400).json({ error: 'groupId and plaintext are required' });
      return;
    }

    const ciphertext = await GroupEncryptionService.encryptGroupMessage(groupId, userId, plaintext);

    res.status(200).json({
      ciphertext,
      groupId,
      senderId: userId,
    });
  } catch (error: any) {
    console.error('Encrypt group message error:', error);
    res.status(500).json({ error: error.message || 'Failed to encrypt message' });
  }
};

/**
 * Decrypt a group message (for testing purposes)
 */
export const decryptGroupMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, senderId, ciphertext } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!groupId || !senderId || !ciphertext) {
      res.status(400).json({ error: 'groupId, senderId, and ciphertext are required' });
      return;
    }

    const plaintext = await GroupEncryptionService.decryptGroupMessage(
      groupId,
      senderId,
      ciphertext,
      userId
    );

    res.status(200).json({
      plaintext,
      groupId,
      senderId,
    });
  } catch (error: any) {
    console.error('Decrypt group message error:', error);
    res.status(500).json({ error: error.message || 'Failed to decrypt message' });
  }
};

/**
 * Rotate all sender keys in a group (admin action after member removal)
 */
export const rotateAllSenderKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await GroupEncryptionService.rotateAllSenderKeys(groupId);

    res.status(200).json({
      message: 'All sender keys rotated successfully',
      groupId,
    });
  } catch (error: any) {
    console.error('Rotate all sender keys error:', error);
    res.status(500).json({ error: error.message || 'Failed to rotate all sender keys' });
  }
};
