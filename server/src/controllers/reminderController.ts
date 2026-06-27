import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  saveReminder, 
  getReminder, 
  deleteReminder, 
  getUserReminders,
  getTask,
  getGoal
} from '../config/db.js';
import crypto from 'crypto';

export async function createReminder(req: AuthenticatedRequest, res: Response) {
  const { type, targetId, title, message, recurrence, timing } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !type || !timing || !Array.isArray(timing)) {
    return res.status(400).json({ error: 'Title, Type, and Timing array are required' });
  }

  try {
    const timestamp = new Date().toISOString();
    const reminderId = crypto.randomUUID();

    // Compute initial trigger times
    const triggerTimes: string[] = [];
    const now = new Date();

    for (const t of timing) {
      if (t.type === 'exact') {
        const dt = new Date(t.time);
        if (dt > now) {
          triggerTimes.push(dt.toISOString());
        }
      } else if (t.type === 'before_due' && targetId) {
        // Calculate offset relative to task or goal due date
        let dueDate: Date | null = null;
        if (type === 'task') {
          const task = await getTask(targetId);
          if (task) dueDate = new Date(task.dueDate);
        } else if (type === 'goal') {
          const goal = await getGoal(targetId);
          if (goal) dueDate = new Date(goal.deadline);
        }

        if (dueDate && !isNaN(dueDate.getTime())) {
          const offsetMinutes = parseInt(t.time) || 0;
          const trigger = new Date(dueDate.getTime() - offsetMinutes * 60000);
          if (trigger > now) {
            triggerTimes.push(trigger.toISOString());
          }
        }
      }
    }

    const newReminder = {
      id: reminderId,
      userId: username,
      type,
      targetId: targetId || null,
      title,
      message: message || '',
      recurrence: recurrence || 'none',
      timing,
      triggerTimes,
      createdAt: timestamp
    };

    await saveReminder(reminderId, newReminder);

    return res.status(201).json({ reminder: newReminder });
  } catch (error) {
    console.error('Create reminder error:', error);
    return res.status(500).json({ error: 'Failed to create reminder' });
  }
}

export async function listReminders(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const reminders = getUserReminders(username);
    return res.json({ reminders });
  } catch (error) {
    console.error('List reminders error:', error);
    return res.status(500).json({ error: 'Failed to retrieve reminders' });
  }
}

export async function deleteReminderEndpoint(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const reminder = await getReminder(id);
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (reminder.userId.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own reminders' });
    }

    await deleteReminder(id);
    return res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return res.status(500).json({ error: 'Failed to delete reminder' });
  }
}
