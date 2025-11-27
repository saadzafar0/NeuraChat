import { Request, Response } from 'express';
import { NotificationService } from '../services/Notifications/NotificationService';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    // Assuming you have Auth Middleware attaching user to req
    const userId = (req as any).user?.id; 
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    if (!userId) {
       res.status(401).json({ error: 'Unauthorized' });
       return;
    }

    const result = await NotificationService.getUserNotifications(userId, limit, offset);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const updated = await NotificationService.markAsRead(id, userId);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    await NotificationService.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};