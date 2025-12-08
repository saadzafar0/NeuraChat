import { getSupabaseClient } from '../config/database';
import path from 'path';

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export class StorageService {
  private bucketName = 'chat-media';

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    file: Express.Multer.File,
    chatId: string,
    userId: string
  ): Promise<UploadResult> {
    try {
      const supabase = getSupabaseClient();
      
      // Sanitize filename (remove special characters)
      const sanitizedFilename = this.sanitizeFilename(file.originalname);
      
      // Create unique path: {chatId}/{userId}/{timestamp}_{filename}
      const timestamp = Date.now();
      const storagePath = `${chatId}/${userId}/${timestamp}_${sanitizedFilename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Supabase Storage Error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);

      return {
        url: urlData.publicUrl,
        path: storagePath,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      console.error('Storage upload error:', error);
      throw error;
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        console.error('Supabase Storage Delete Error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Storage delete error:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail URL for images
   */
  async generateThumbnail(storagePath: string): Promise<string | null> {
    try {
      const supabase = getSupabaseClient();
      
      const { data } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath, {
          transform: {
            width: 200,
            height: 200,
            resize: 'cover',
          },
        });

      return data.publicUrl;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  }

  /**
   * Get file type category from MIME type
   */
  getFileTypeCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('text') ||
      mimeType.includes('sheet')
    ) {
      return 'document';
    }
    return 'file';
  }

  /**
   * Sanitize filename (remove special characters, keep extension)
   */
  private sanitizeFilename(filename: string): string {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    
    // Remove special characters, keep alphanumeric, spaces, hyphens, underscores
    const sanitized = name
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100); // Limit length

    return `${sanitized}${ext}`;
  }

  /**
   * Check if bucket exists and is accessible
   */
  async checkBucketAccess(): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.getBucket(this.bucketName);
      return !error && data !== null;
    } catch (error) {
      console.error('Bucket access check failed:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();
