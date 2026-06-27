import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  saveNotification, 
  getNotification, 
  deleteNotification, 
  getUserNotifications
} from '../config/db.js';

export async function listNotifications(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;
  const { read, category, priority, search } = req.query;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let notifications = getUserNotifications(username);

    // Apply filtering
    if (read !== undefined) {
      const isRead = read === 'true';
      notifications = notifications.filter(n => n.read === isRead);
    }

    if (category && typeof category === 'string') {
      notifications = notifications.filter(n => n.category.toLowerCase() === category.toLowerCase());
    }

    if (priority && typeof priority === 'string') {
      notifications = notifications.filter(n => n.priority.toLowerCase() === priority.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const query = search.toLowerCase();
      notifications = notifications.filter(n => 
        n.title.toLowerCase().includes(query) || 
        n.description.toLowerCase().includes(query)
      );
    }

    // Sort by newest first
    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return res.json({ notifications });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notification = await getNotification(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.username.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    notification.read = true;
    await saveNotification(id, notification);

    return res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notifications = getUserNotifications(username);
    let count = 0;

    for (const notif of notifications) {
      if (!notif.read) {
        notif.read = true;
        await saveNotification(notif.id, notif);
        count++;
      }
    }

    return res.json({ message: `Successfully marked ${count} notifications as read` });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
}

export async function deleteNotificationEndpoint(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notification = await getNotification(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.username.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deleteNotification(id);
    return res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
}
