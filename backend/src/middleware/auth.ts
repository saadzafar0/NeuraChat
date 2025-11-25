import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type AuthRequest = Request & {
  userId?: string;
};

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Get token from cookie only
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
