import { getAllReminders, saveReminder, saveNotification, getGroupMembers, getTask, getGoal, Reminder } from '../config/db.js';
import { sendToUser } from '../config/socket.js';
import { sendEmail, getEmailTemplate } from './emailService.js';
import crypto from 'crypto';

let intervalId: NodeJS.Timeout | null = null;

export function startReminderEngine() {
  if (intervalId) return;

  // Run check every minute
  intervalId = setInterval(async () => {
    try {
      await checkReminders();
    } catch (err) {
      console.error('Error in reminder engine interval check:', err);
    }
  }, 60 * 1000);

  console.log('Zenith Focus Reminder Engine started (checking every minute).');
}

export function stopReminderEngine() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function checkReminders() {
  const now = new Date();
  const nowMs = now.getTime();
  const reminders = getAllReminders();

  for (const reminder of reminders) {
    const triggerTimes = [...reminder.triggerTimes];
    let triggeredAny = false;
    const remainingTriggers: string[] = [];

    for (const timeStr of triggerTimes) {
      const triggerTime = new Date(timeStr);
      const diffMs = triggerTime.getTime() - nowMs;

      // Trigger if time is in past or within the current minute window
      if (diffMs <= 0 && Math.abs(diffMs) < 120000) { // 2 minutes window to avoid misses
        triggeredAny = true;
        await triggerReminder(reminder);
      } else if (diffMs > 0) {
        remainingTriggers.push(timeStr);
      }
    }

    if (triggeredAny) {
      reminder.lastTriggered = now.toISOString();

      // Handle recurrence calculation
      if (reminder.recurrence !== 'none') {
        const nextTriggers = calculateNextTriggers(reminder, now);
        reminder.triggerTimes = nextTriggers;
      } else {
        reminder.triggerTimes = remainingTriggers;
      }

      await saveReminder(reminder.id, reminder);
    }
  }
}

function calculateNextTriggers(reminder: Reminder, baseTime: Date): string[] {
  const next = new Date(baseTime);
  
  if (reminder.recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (reminder.recurrence === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (reminder.recurrence === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 1);
  }

  // Update base times for next run
  return reminder.timing.map(() => next.toISOString());
}

async function triggerReminder(reminder: Reminder) {
  const timestamp = new Date().toISOString();
  console.log(`Triggering reminder: [${reminder.type}] ${reminder.title} for user: ${reminder.userId}`);

  // Fetch recipients: default is reminder owner, or all group members for group type
  let recipients = [reminder.userId.toLowerCase()];
  
  if (reminder.type === 'group' && reminder.targetId) {
    const members = getGroupMembers(reminder.targetId);
    if (members.length > 0) {
      recipients = members.map(m => m.username.toLowerCase());
    }
  }

  // Dispatch to all targeted recipients
  for (const recipient of recipients) {
    const notificationId = crypto.randomUUID();
    const notification = {
      id: notificationId,
      username: recipient,
      type: 'reminder' as const,
      title: reminder.title,
      description: reminder.message,
      read: false,
      createdAt: timestamp,
      category: 'reminder',
      priority: 'high' as const,
      metadata: { 
        reminderId: reminder.id, 
        targetId: reminder.targetId, 
        type: reminder.type 
      }
    };

    // Save notification locally & sync
    await saveNotification(notificationId, notification);

    // Socket.IO updates
    sendToUser(recipient, 'notification_added', notification);
    sendToUser(recipient, 'toast_message', {
      title: reminder.title,
      description: reminder.message,
      type: 'info'
    });

    // Send styled Email
    const htmlBody = `
      <h2>Reminder Alert</h2>
      <p>This is a scheduled reminder for you:</p>
      <div style="background-color: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #a855f7; margin: 15px 0; color: #cbd5e1;">
        <strong style="color: #ffffff;">${reminder.title}</strong><br/>
        ${reminder.message}
      </div>
      <p>Time: ${new Date(timestamp).toLocaleString()}</p>
    `;
    const textBody = `Reminder Alert:\n\n${reminder.title}\n${reminder.message}\n\nTime: ${new Date(timestamp).toLocaleString()}`;
    
    await sendEmail({
      toUsername: recipient,
      subject: `Zenith Reminder: ${reminder.title}`,
      category: 'reminder',
      html: getEmailTemplate(reminder.title, htmlBody),
      text: textBody
    }).catch(e => console.error('Failed to send reminder email:', e));
  }
}

/**
 * Generate 24h, 2h, and 30m reminders for upcoming tasks automatically
 */
export async function syncTaskReminders(taskId: string) {
  const task = await getTask(taskId);
  if (!task || task.status === 'completed') return;

  const dueDate = new Date(task.dueDate);
  if (isNaN(dueDate.getTime())) return;

  const offsets = [
    { name: '24 Hours Before', ms: 24 * 60 * 60 * 1000, value: '1440' },
    { name: '2 Hours Before', ms: 2 * 60 * 60 * 1000, value: '120' },
    { name: '30 Minutes Before', ms: 30 * 60 * 1000, value: '30' }
  ];

  const now = new Date();
  
  for (const offset of offsets) {
    const triggerTime = new Date(dueDate.getTime() - offset.ms);
    if (triggerTime > now) {
      const reminderId = `task_${taskId}_${offset.value}`;
      
      const reminder = {
        id: reminderId,
        userId: task.createdBy,
        type: 'task' as const,
        targetId: taskId,
        title: `Task Due Soon: ${task.title}`,
        message: `"${task.title}" is due in ${offset.name.toLowerCase()}. Priority is ${task.priority.toUpperCase()}.`,
        recurrence: 'none' as const,
        timing: [{ type: 'before_due' as const, time: offset.value }],
        triggerTimes: [triggerTime.toISOString()],
        createdAt: now.toISOString()
      };

      await saveReminder(reminderId, reminder);
    }
  }
}

/**
 * Generate 24h reminder warnings for goal deadlines
 */
export async function syncGoalReminders(goalId: string, username: string) {
  const goal = await getGoal(goalId);
  if (!goal) return;

  const deadline = new Date(goal.deadline);
  if (isNaN(deadline.getTime())) return;

  const triggerTime = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
  const now = new Date();

  if (triggerTime > now) {
    const reminderId = `goal_${goalId}_24h`;
    const reminder = {
      id: reminderId,
      userId: username,
      type: 'goal' as const,
      targetId: goalId,
      title: `Goal Deadline Tomorrow: ${goal.title}`,
      message: `The deadline for your team goal "${goal.title}" is tomorrow. Current progress: ${goal.progress}%.`,
      recurrence: 'none' as const,
      timing: [{ type: 'before_due' as const, time: '1440' }],
      triggerTimes: [triggerTime.toISOString()],
      createdAt: now.toISOString()
    };

    await saveReminder(reminderId, reminder);
  }
}
