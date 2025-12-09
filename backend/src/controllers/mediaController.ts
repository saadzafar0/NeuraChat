import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { storageService } from '../services/storageService';
import { io } from '../server';

type AuthRequest = Request & {
  userId?: string;
  user?: { userId: string };
};

/**
 * Upload file to chat
 */
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const userId = req.userId;
    const { chatId, messageContent } = req.body;
    const file = req.file;

    // Validate inputs
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    if (!chatId) {
      res.status(400).json({ error: 'Chat ID is required' });
      return;
    }

    // Check if user is participant in chat
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ 
        error: 'Access denied',
        message: 'You are not a member of this chat' 
      });
      return;
    }

    // Upload to Supabase Storage
    const uploadResult = await storageService.uploadFile(file, chatId, userId!);

    // Get file type category
    const fileType = storageService.getFileTypeCategory(uploadResult.mimeType);

    // Generate thumbnail for images
    let thumbnailUrl = null;
    if (fileType === 'image') {
      thumbnailUrl = await storageService.generateThumbnail(uploadResult.path);
    }

    // Create message record (if messageContent is provided or default)
    let messageId = null;
    const content = messageContent || `Shared a ${fileType}: ${file.originalname}`;
    
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content,
        type: 'media',
        status: 'sent',
      })
      .select('*')
      .single();

    if (messageError) {
      console.error('Message creation error:', messageError);
      // Continue anyway, file is uploaded
    } else {
      messageId = message?.id;
    }

    // Insert media file record
    const { data: mediaFile, error: mediaError } = await supabase
      .from('media_files')
      .insert({
        message_id: messageId,
        chat_id: chatId,
        file_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.mimetype,
        storage_url: uploadResult.url,
        storage_path: uploadResult.path,
        thumbnail_url: thumbnailUrl,
        uploaded_by: userId,
        upload_status: 'completed',
      })
      .select('*')
      .single();

    if (mediaError) {
      console.error('Media file record error:', mediaError);
      // Rollback: delete uploaded file
      await storageService.deleteFile(uploadResult.path);
      res.status(500).json({ 
        error: 'Failed to save file metadata',
        details: mediaError.message 
      });
      return;
    }

    // Get sender info for response
    const { data: sender } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url')
      .eq('id', userId)
      .single();

    // Emit Socket.IO event for real-time update
    io.to(`chat:${chatId}`).emit('new-file', {
      file: mediaFile,
      message: message ? {
        ...message,
        users: sender,
      } : null,
      uploadedBy: sender,
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      file: mediaFile,
      messageData: message ? {
        ...message,
        users: sender,
      } : null,
    });
  } catch (error: any) {
    console.error('Upload file error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Get all media files for a chat
 */
export const getChatMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const userId = req.userId;
    const { type, limit = 50, offset = 0 } = req.query;

    // Verify user is participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Build query
    let query = supabase
      .from('media_files')
      .select('*, users!uploaded_by(id, username, full_name, avatar_url)', { count: 'exact' })
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });

    // Filter by type if specified
    if (type && typeof type === 'string') {
      query = query.eq('file_type', type);
    }

    // Apply pagination
    const { data, error, count } = await query
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      files: data,
      total: count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Get chat media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get single media file details
 */
export const getMediaFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { fileId } = req.params;
    const userId = req.userId;

    // Get file with user info
    const { data: file, error: fileError } = await supabase
      .from('media_files')
      .select('*, users!uploaded_by(id, username, full_name, avatar_url)')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Verify user is participant in the chat
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', file.chat_id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ file });
  } catch (error) {
    console.error('Get media file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a media file
 */
export const deleteMediaFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { fileId } = req.params;
    const userId = req.userId;

    // Get file details
    const { data: file, error: fileError } = await supabase
      .from('media_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check if user is the uploader or admin of the chat
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('role')
      .eq('chat_id', file.chat_id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Only uploader or admin can delete
    if (file.uploaded_by !== userId && participant.role !== 'admin') {
      res.status(403).json({ 
        error: 'Permission denied',
        message: 'Only the uploader or chat admin can delete this file' 
      });
      return;
    }

    // Delete from storage
    try {
      await storageService.deleteFile(file.storage_path);
    } catch (storageError) {
      console.error('Storage deletion failed:', storageError);
      // Continue to delete database record anyway
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('media_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      res.status(500).json({ error: 'Failed to delete file record' });
      return;
    }

    // Emit Socket.IO event for real-time update
    io.to(`chat:${file.chat_id}`).emit('file-removed', {
      fileId,
      chatId: file.chat_id,
      deletedBy: userId,
    });

    res.json({ 
      message: 'File deleted successfully',
      fileId 
    });
  } catch (error) {
    console.error('Delete media file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Download a media file (generates download URL)
 */
export const downloadMediaFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { fileId } = req.params;
    const userId = req.userId;

    // Get file details
    const { data: file, error: fileError } = await supabase
      .from('media_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Verify user is participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', file.chat_id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Return the storage URL (already public)
    res.json({
      downloadUrl: file.storage_url,
      fileName: file.file_name,
      fileSize: file.file_size,
      mimeType: file.mime_type,
    });
  } catch (error) {
    console.error('Download media file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get media statistics for a chat
 */
export const getChatMediaStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { chatId } = req.params;
    const userId = req.userId;

    // Verify user is participant
    const { data: participant, error: participantError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get counts by type
    const { data: stats, error: statsError } = await supabase
      .from('media_files')
      .select('file_type')
      .eq('chat_id', chatId);

    if (statsError) {
      res.status(400).json({ error: statsError.message });
      return;
    }

    // Count by type
    const typeCounts: Record<string, number> = {};
    let totalSize = 0;

    stats?.forEach((file: any) => {
      typeCounts[file.file_type] = (typeCounts[file.file_type] || 0) + 1;
    });

    // Get total size
    const { data: sizeData } = await supabase
      .from('media_files')
      .select('file_size')
      .eq('chat_id', chatId);

    sizeData?.forEach((file: any) => {
      totalSize += file.file_size || 0;
    });

    res.json({
      total: stats?.length || 0,
      byType: typeCounts,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    });
  } catch (error) {
    console.error('Get chat media stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
