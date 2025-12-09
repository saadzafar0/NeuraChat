import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// File size limits (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  archives: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ],
};

// Flatten all allowed types
const ALL_ALLOWED_TYPES = Object.values(ALLOWED_MIME_TYPES).flat();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

// Multer configuration (store in memory)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

// Error handler for multer errors
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      error: 'Invalid file',
      message: err.message,
    });
  }
  
  next();
};
