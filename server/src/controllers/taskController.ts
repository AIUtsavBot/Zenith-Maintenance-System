import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  saveTask, 
  getTask, 
  deleteTask, 
  getGroupTasks, 
  getUserTasks, 
  saveTaskAssignment, 
  getTaskAssignments, 
  deleteTaskAssignment,
  getMember,
  saveNotification,
  saveActivityLog
} from '../config/db.js';
import { syncTaskReminders } from '../services/reminderEngine.js';
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

export async function createTask(req: AuthenticatedRequest, res: Response) {
  const { groupId, title, description, priority, dueDate, tags, repeatOption, checklist, assignedUsers } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!title || !dueDate) {
    return res.status(400).json({ error: 'Title and Due Date are required' });
  }

  try {
    const timestamp = new Date().toISOString();
    
    // Check permission if group task
    if (groupId) {
      const allowed = await checkGroupPermission(groupId, username, 'admin');
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied: Only Owners and Admins can create tasks in this group' });
      }
    }

    const taskId = crypto.randomUUID();
    const newTask: any = {
      id: taskId,
      groupId: groupId || null,
      title,
      description: description || '',
      priority: priority || 'medium',
      status: 'todo',
      dueDate,
      createdBy: username,
      tags: tags || [],
      attachments: [],
      repeatOption: repeatOption || 'none',
      checklist: checklist || [],
      progress: 0,
      comments: [],
      createdAt: timestamp
    };

    await saveTask(taskId, newTask);

    // Save Assignments
    const finalAssigned: string[] = [];
    if (assignedUsers && Array.isArray(assignedUsers)) {
      for (const assignedUser of assignedUsers) {
        const assignId = `${taskId}_${assignedUser.toLowerCase()}`;
        await saveTaskAssignment(assignId, {
          id: assignId,
          taskId,
          username: assignedUser
        });
        finalAssigned.push(assignedUser);

        // Notify assigned user (if not creator)
        if (assignedUser.toLowerCase() !== username.toLowerCase()) {
          const notifId = crypto.randomUUID();
          const notif = {
            id: notifId,
            username: assignedUser,
            type: 'task_assigned' as const,
            title: 'New Task Assigned',
            description: `${username} assigned you the task "${title}".`,
            read: false,
            createdAt: timestamp,
            category: 'task',
            priority: 'medium' as const,
            metadata: { taskId, groupId }
          };
          await saveNotification(notifId, notif);
          sendToUser(assignedUser, 'notification_added', notif);
        }
      }
    }

    // Auto sync task warnings (reminder scheduler offsets)
    await syncTaskReminders(taskId);

    // Save Activity Log
    if (groupId) {
      const logId = crypto.randomUUID();
      await saveActivityLog(logId, {
        id: logId,
        groupId,
        username,
        action: `created task "${title}"`,
        createdAt: timestamp
      });
      
      // Notify group
      sendToGroup(groupId, 'task_created', { task: newTask, assignedUsers: finalAssigned });
    }

    return res.status(201).json({ task: newTask, assignedUsers: finalAssigned });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function getTasksList(req: AuthenticatedRequest, res: Response) {
  const { groupId } = req.query;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let tasks = [];
    if (groupId && typeof groupId === 'string') {
      // Check membership
      const isMember = await checkGroupPermission(groupId, username, 'member');
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
      }
      tasks = getGroupTasks(groupId);
    } else {
      // Personal list (all tasks user created or is assigned to)
      tasks = getUserTasks(username);
    }

    // Enrich tasks with assignment lists
    const enrichedTasks = [];
    for (const task of tasks) {
      const assigns = getTaskAssignments(task.id);
      enrichedTasks.push({
        ...task,
        assignedUsers: assigns.map(a => a.username)
      });
    }

    return res.json({ tasks: enrichedTasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
}

export async function getTaskDetails(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const task: any = await getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.groupId) {
      const isMember = await checkGroupPermission(task.groupId, username, 'member');
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const assigns = getTaskAssignments(id);
    return res.json({
      task: {
        ...task,
        assignedUsers: assigns.map(a => a.username)
      }
    });
  } catch (error) {
    console.error('Get task details error:', error);
    return res.status(500).json({ error: 'Failed to retrieve task details' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, description, priority, status, dueDate, tags, repeatOption, checklist, assignedUsers, progress } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const task: any = await getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const timestamp = new Date().toISOString();

    // Verify update permissions
    if (task.groupId) {
      // Owner/Admin can edit anything. Members can view/complete assigned, but not change core fields
      const isAdmin = await checkGroupPermission(task.groupId, username, 'admin');
      const isAssignee = getTaskAssignments(id).some(a => a.username.toLowerCase() === username.toLowerCase());
      
      if (!isAdmin && !isAssignee) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to edit this task' });
      }
    }

    const dueDateChanged = dueDate && dueDate !== task.dueDate;

    // Update core fields
    task.title = title || task.title;
    task.description = description !== undefined ? description : task.description;
    task.priority = priority || task.priority;
    task.status = status || task.status;
    task.dueDate = dueDate || task.dueDate;
    task.tags = tags || task.tags;
    task.repeatOption = repeatOption || task.repeatOption;
    task.checklist = checklist || task.checklist;
    task.progress = progress !== undefined ? progress : task.progress;

    if (task.status === 'completed') {
      task.progress = 100;
    }

    await saveTask(id, task);

    // Update Assignments if provided
    let finalAssigned: string[] = [];
    if (assignedUsers && Array.isArray(assignedUsers)) {
      // Clear current assignments
      const currentAssigns = getTaskAssignments(id);
      for (const assign of currentAssigns) {
        await deleteTaskAssignment(assign.id);
      }

      // Add new assignments
      for (const assignedUser of assignedUsers) {
        const assignId = `${id}_${assignedUser.toLowerCase()}`;
        await saveTaskAssignment(assignId, {
          id: assignId,
          taskId: id,
          username: assignedUser
        });
        finalAssigned.push(assignedUser);

        // Notify newly assigned users
        if (!currentAssigns.some(a => a.username.toLowerCase() === assignedUser.toLowerCase()) && assignedUser.toLowerCase() !== username.toLowerCase()) {
          const notifId = crypto.randomUUID();
          const notif = {
            id: notifId,
            username: assignedUser,
            type: 'task_assigned' as const,
            title: 'Task Assigned',
            description: `${username} assigned you "${task.title}".`,
            read: false,
            createdAt: timestamp,
            category: 'task',
            priority: 'medium' as const,
            metadata: { taskId: id, groupId: task.groupId }
          };
          await saveNotification(notifId, notif);
          sendToUser(assignedUser, 'notification_added', notif);
        }
      }
    } else {
      finalAssigned = getTaskAssignments(id).map(a => a.username);
    }

    // Trigger notification for updates
    const assigns = getTaskAssignments(id);
    for (const assign of assigns) {
      if (assign.username.toLowerCase() !== username.toLowerCase()) {
        const notifId = crypto.randomUUID();
        const notif = {
          id: notifId,
          username: assign.username,
          type: 'goal_updated' as const, // represents task edited general updates
          title: 'Task Updated',
          description: `Task "${task.title}" was updated by ${username}.`,
          read: false,
          createdAt: timestamp,
          category: 'task',
          priority: 'low' as const,
          metadata: { taskId: id }
        };
        await saveNotification(notifId, notif);
        sendToUser(assign.username, 'notification_added', notif);
      }
    }

    // Re-sync reminders if due date changed
    if (dueDateChanged) {
      await syncTaskReminders(id);
    }

    if (task.groupId) {
      const logId = crypto.randomUUID();
      await saveActivityLog(logId, {
        id: logId,
        groupId: task.groupId,
        username,
        action: `updated task "${task.title}"`,
        createdAt: timestamp
      });

      sendToGroup(task.groupId, 'task_updated', { task, assignedUsers: finalAssigned });
    }

    return res.json({ task, assignedUsers: finalAssigned });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
}

export async function completeTask(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const task: any = await getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const timestamp = new Date().toISOString();
    
    // Mark as completed
    task.status = 'completed';
    task.progress = 100;
    
    await saveTask(id, task);

    // Notify creator
    if (task.createdBy.toLowerCase() !== username.toLowerCase()) {
      const notifId = crypto.randomUUID();
      const notif = {
        id: notifId,
        username: task.createdBy,
        type: 'task_completed' as const,
        title: 'Task Completed',
        description: `${username} completed "${task.title}".`,
        read: false,
        createdAt: timestamp,
        category: 'task',
        priority: 'medium' as const,
        metadata: { taskId: id }
      };
      await saveNotification(notifId, notif);
      sendToUser(task.createdBy, 'notification_added', notif);
    }

    if (task.groupId) {
      const logId = crypto.randomUUID();
      await saveActivityLog(logId, {
        id: logId,
        groupId: task.groupId,
        username,
        action: `completed task "${task.title}"`,
        createdAt: timestamp
      });

      sendToGroup(task.groupId, 'task_completed', { taskId: id, username });
    }

    return res.json({ message: 'Task marked as completed', task });
  } catch (error) {
    console.error('Complete task error:', error);
    return res.status(500).json({ error: 'Failed to complete task' });
  }
}

export async function addTaskComment(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { text } = req.body;
  const username = req.user?.username;
  const name = req.user?.name;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  try {
    const task: any = await getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const timestamp = new Date().toISOString();
    const comment = {
      id: crypto.randomUUID(),
      username,
      name: name || username,
      text,
      createdAt: timestamp
    };

    if (!task.comments) {
      task.comments = [];
    }

    task.comments.push(comment);
    await saveTask(id, task);

    // Notify assigned users and creator
    const recipients = new Set<string>();
    recipients.add(task.createdBy.toLowerCase());
    const assigns = getTaskAssignments(id);
    for (const a of assigns) {
      recipients.add(a.username.toLowerCase());
    }
    recipients.delete(username.toLowerCase()); // don't notify self

    for (const recipient of recipients) {
      const notifId = crypto.randomUUID();
      const notif = {
        id: notifId,
        username: recipient,
        type: 'comment_added' as any, // dynamic in template
        title: 'New Comment on Task',
        description: `${username} commented on "${task.title}": "${text.slice(0, 30)}..."`,
        read: false,
        createdAt: timestamp,
        category: 'task',
        priority: 'low' as const,
        metadata: { taskId: id, commentId: comment.id }
      };
      await saveNotification(notifId, notif);
      sendToUser(recipient, 'notification_added', notif);
    }

    if (task.groupId) {
      const logId = crypto.randomUUID();
      await saveActivityLog(logId, {
        id: logId,
        groupId: task.groupId,
        username,
        action: `commented on task "${task.title}"`,
        createdAt: timestamp
      });

      sendToGroup(task.groupId, 'comment_added', { taskId: id, comment });
    }

    return res.status(201).json({ comment, task });
  } catch (error) {
    console.error('Add task comment error:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

export async function deleteTaskEndpoint(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const task: any = await getTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.groupId) {
      const isAdmin = await checkGroupPermission(task.groupId, username, 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied: Only owners/admins can delete team tasks' });
      }
    } else {
      if (task.createdBy.toLowerCase() !== username.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied: You cannot delete this task' });
      }
    }

    await deleteTask(id);

    if (task.groupId) {
      const timestamp = new Date().toISOString();
      const logId = crypto.randomUUID();
      await saveActivityLog(logId, {
        id: logId,
        groupId: task.groupId,
        username,
        action: `deleted task "${task.title}"`,
        createdAt: timestamp
      });

      sendToGroup(task.groupId, 'task_deleted', { taskId: id });
    }

    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}
