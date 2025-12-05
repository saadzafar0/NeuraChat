import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type AuthRequest = Request & {
  userId?: string;
  user?: { userId: string };
};

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Get token from cookie only
  const token = req.cookies?.token;

  if (!token) {
    console.log('Auth Failed: No token found in cookies or headers');
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { userId: string };
    req.userId = decoded.userId;
    req.user = { userId: decoded.userId }; // Add user object for controller compatibility
    console.log('Auth Success: User ID', decoded.userId);
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
