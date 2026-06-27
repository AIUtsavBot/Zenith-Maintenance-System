import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import {
  saveGoal,
  getGoal,
  deleteGoal,
  getGroupGoals,
  saveGoalMember,
  getGoalMembers,
  deleteGoalMember,
  getMember,
  saveNotification,
  saveActivityLog
} from '../config/db.js';
import { syncGoalReminders } from '../services/reminderEngine.js';
import { sendToGroup, sendToUser } from '../config/socket.js';
import crypto from 'crypto';

// Helper to check user permission in a group
async function checkGroupPermission(groupId: string, username: string, requiredRole: 'owner' | 'admin' | 'member'): Promise<boolean> {
  const member = await getMember(`${groupId}_${username.toLowerCase()}`);
  if (!member) return false;
  if (requiredRole === 'owner') return member.role === 'owner';
  if (requiredRole === 'admin') return member.role === 'owner' || member.role === 'admin';
  return true; // member covers all
}

export async function createGoal(req: AuthenticatedRequest, res: Response) {
  const { groupId, title, description, deadline, milestones, assignedMembers } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!groupId || !title || !deadline) {
    return res.status(400).json({ error: 'GroupId, Title, and Deadline are required' });
  }

  try {
    const isAllowed = await checkGroupPermission(groupId, username, 'admin');
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied: Only owners and admins can create goals' });
    }

    const timestamp = new Date().toISOString();
    const goalId = crypto.randomUUID();

    const newGoal = {
      id: goalId,
      groupId,
      title,
      description: description || '',
      deadline,
      milestones: milestones || [],
      progress: 0,
      completionPercent: 0,
      createdAt: timestamp
    };

    await saveGoal(goalId, newGoal);

    // Save Goal Members
    const finalAssigned: string[] = [];
    if (assignedMembers && Array.isArray(assignedMembers)) {
      for (const memberUsername of assignedMembers) {
        const gmId = `${goalId}_${memberUsername.toLowerCase()}`;
        await saveGoalMember(gmId, {
          id: gmId,
          goalId,
          username: memberUsername
        });
        finalAssigned.push(memberUsername);

        // Notify member
        if (memberUsername.toLowerCase() !== username.toLowerCase()) {
          const notifId = crypto.randomUUID();
          const notif = {
            id: notifId,
            username: memberUsername,
            type: 'goal_updated' as const,
            title: 'New Group Goal Assigned',
            description: `${username} assigned you to the group goal "${title}".`,
            read: false,
            createdAt: timestamp,
            category: 'goal',
            priority: 'medium' as const,
            metadata: { goalId, groupId }
          };
          await saveNotification(notifId, notif);
          sendToUser(memberUsername, 'notification_added', notif);
        }
      }
    }

    // Auto sync goal reminders
    await syncGoalReminders(goalId, username);

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId,
      username,
      action: `created goal "${title}"`,
      createdAt: timestamp
    });

    sendToGroup(groupId, 'goal_created', { goal: newGoal, assignedMembers: finalAssigned });

    return res.status(201).json({ goal: newGoal, assignedMembers: finalAssigned });
  } catch (error) {
    console.error('Create goal error:', error);
    return res.status(500).json({ error: 'Failed to create goal' });
  }
}

export async function listGoals(req: AuthenticatedRequest, res: Response) {
  const { groupId } = req.query;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'GroupId query parameter is required' });
  }

  try {
    const isMember = await checkGroupPermission(groupId, username, 'member');
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
    }

    const goals = getGroupGoals(groupId);
    const enrichedGoals = [];

    for (const goal of goals) {
      const members = getGoalMembers(goal.id);
      enrichedGoals.push({
        ...goal,
        assignedMembers: members.map(m => m.username)
      });
    }

    return res.json({ goals: enrichedGoals });
  } catch (error) {
    console.error('List goals error:', error);
    return res.status(500).json({ error: 'Failed to retrieve goals' });
  }
}

export async function updateGoal(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, description, deadline, milestones, assignedMembers, progress, completionPercent } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const goal = await getGoal(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const isAllowed = await checkGroupPermission(goal.groupId, username, 'admin');
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied: Only owners and admins can edit goals' });
    }

    const timestamp = new Date().toISOString();

    goal.title = title || goal.title;
    goal.description = description !== undefined ? description : goal.description;
    goal.deadline = deadline || goal.deadline;
    goal.milestones = milestones || goal.milestones;
    goal.progress = progress !== undefined ? progress : goal.progress;
    goal.completionPercent = completionPercent !== undefined ? completionPercent : goal.completionPercent;

    // Recalculate completion percentage if milestones changed
    if (milestones && milestones.length > 0) {
      const completedCount = milestones.filter((m: any) => m.completed).length;
      goal.completionPercent = Math.round((completedCount / milestones.length) * 100);
      goal.progress = goal.completionPercent;
    }

    await saveGoal(id, goal);

    // Update Goal Members
    let finalAssigned: string[] = [];
    if (assignedMembers && Array.isArray(assignedMembers)) {
      // Clear current assignments
      const currentMembers = getGoalMembers(id);
      for (const m of currentMembers) {
        await deleteGoalMember(m.id);
      }

      // Add new assignments
      for (const memberUsername of assignedMembers) {
        const gmId = `${id}_${memberUsername.toLowerCase()}`;
        await saveGoalMember(gmId, {
          id: gmId,
          goalId: id,
          username: memberUsername
        });
        finalAssigned.push(memberUsername);

        // Notify newly assigned members
        if (!currentMembers.some(m => m.username.toLowerCase() === memberUsername.toLowerCase()) && memberUsername.toLowerCase() !== username.toLowerCase()) {
          const notifId = crypto.randomUUID();
          const notif = {
            id: notifId,
            username: memberUsername,
            type: 'goal_updated' as const,
            title: 'Goal Assigned',
            description: `${username} assigned you to "${goal.title}".`,
            read: false,
            createdAt: timestamp,
            category: 'goal',
            priority: 'medium' as const,
            metadata: { goalId: id, groupId: goal.groupId }
          };
          await saveNotification(notifId, notif);
          sendToUser(memberUsername, 'notification_added', notif);
        }
      }
    } else {
      finalAssigned = getGoalMembers(id).map(m => m.username);
    }

    // Notify all assigned members of goal updates
    const members = getGoalMembers(id);
    for (const m of members) {
      if (m.username.toLowerCase() !== username.toLowerCase()) {
        const notifId = crypto.randomUUID();
        const notif = {
          id: notifId,
          username: m.username,
          type: 'goal_updated' as const,
          title: 'Goal Updated',
          description: `Goal "${goal.title}" was updated. Progress: ${goal.progress}%.`,
          read: false,
          createdAt: timestamp,
          category: 'goal',
          priority: 'low' as const,
          metadata: { goalId: id }
        };
        await saveNotification(notifId, notif);
        sendToUser(m.username, 'notification_added', notif);
      }
    }

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: goal.groupId,
      username,
      action: `updated goal "${goal.title}" to ${goal.progress}%`,
      createdAt: timestamp
    });

    sendToGroup(goal.groupId, 'goal_updated', { goal, assignedMembers: finalAssigned });

    return res.json({ goal, assignedMembers: finalAssigned });
  } catch (error) {
    console.error('Update goal error:', error);
    return res.status(500).json({ error: 'Failed to update goal' });
  }
}

export async function deleteGoalEndpoint(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const goal = await getGoal(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const isAllowed = await checkGroupPermission(goal.groupId, username, 'admin');
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied: Only owners and admins can delete goals' });
    }

    await deleteGoal(id);

    const timestamp = new Date().toISOString();
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: goal.groupId,
      username,
      action: `deleted goal "${goal.title}"`,
      createdAt: timestamp
    });

    sendToGroup(goal.groupId, 'goal_deleted', { goalId: id });

    return res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    return res.status(500).json({ error: 'Failed to delete goal' });
  }
}
