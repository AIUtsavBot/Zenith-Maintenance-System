import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Interface structures
export interface BreakRecord {
  start: string;
  end: string | null;
}

export interface SessionData {
  date: string; // YYYY-MM-DD
  status: 'Working' | 'On Break' | 'Offline';
  workStart: string | null;
  workEnd: string | null;
  breaks: BreakRecord[];
  totalBreakMinutes: number;
  totalWorkMinutes: number;
  effectiveWorkMinutes: number;
  notes: string;
  rating: number; // 1-10
  completedTasks: string[];
  goals: string[];
  synced?: boolean;
}

export interface PlannerData {
  date: string; // YYYY-MM-DD
  goals: string[];
  priorities: { text: string; completed: boolean; priority: 'High' | 'Medium' | 'Low' }[];
  checklist: { id: string; text: string; completed: boolean }[];
  reminders: string[];
  synced?: boolean;
}

export interface UserRecord {
  username: string;
  passwordHash?: string; // Optional (e.g. Google-only logins don't require password hash)
  role: 'admin' | 'user';
  name?: string;
  email?: string;
  timezone?: string;
  emailVerified?: boolean;
  synced?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string;
  inviteCode: string;
  owner: string;
  createdAt: string;
  settings?: any;
  synced?: boolean;
}

export interface Member {
  id: string; // "groupId_username"
  groupId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  synced?: boolean;
}

export interface Task {
  id: string;
  groupId: string | null; // null for personal tasks
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  createdBy: string;
  tags: string[];
  attachments: { name: string; url: string }[];
  repeatOption: 'none' | 'daily' | 'weekly' | 'monthly';
  checklist: { id: string; text: string; completed: boolean }[];
  progress: number; // 0 to 100
  createdAt: string;
  synced?: boolean;
}

export interface TaskAssignment {
  id: string; // "taskId_username"
  taskId: string;
  username: string;
  synced?: boolean;
}

export interface Goal {
  id: string;
  groupId: string;
  title: string;
  description: string;
  deadline: string;
  milestones: { id: string; text: string; completed: boolean }[];
  progress: number;
  completionPercent: number;
  createdAt: string;
  synced?: boolean;
}

export interface GoalMember {
  id: string; // "goalId_username"
  goalId: string;
  username: string;
  synced?: boolean;
}

export interface Reminder {
  id: string;
  userId: string;
  type: 'personal' | 'task' | 'goal' | 'group' | 'meeting';
  targetId?: string; // e.g. taskId, goalId, groupId
  title: string;
  message: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
  timing: {
    type: 'exact' | 'before_due' | 'after_due';
    time: string; // ISO date-time for exact, or time duration (e.g. '24h', '2h', '30m')
  }[];
  triggerTimes: string[]; // ISO timestamps of upcoming reminder triggers
  lastTriggered?: string | null;
  createdAt: string;
  synced?: boolean;
}

export interface Notification {
  id: string;
  username: string;
  type: 'task_assigned' | 'reminder' | 'goal_updated' | 'group_invite' | 'member_joined' | 'member_left' | 'task_completed' | 'ai_suggestion' | 'productivity_alert';
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: any;
  synced?: boolean;
}

export interface ActivityLog {
  id: string;
  groupId: string | null;
  username: string;
  action: string;
  targetId?: string;
  targetType?: string;
  createdAt: string;
  synced?: boolean;
}

export interface EmailPreferences {
  username: string;
  receiveReminderEmails: boolean;
  receiveTaskEmails: boolean;
  receiveGoalEmails: boolean;
  receiveWeeklyReports: boolean;
  receiveAiReports: boolean;
  receiveMarketingEmails: boolean;
  enableDND: boolean;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string; // HH:MM
  synced?: boolean;
}

export interface UserSettings {
  username: string;
  theme: 'dark' | 'light';
  offlineFallback: boolean;
  synced?: boolean;
}

interface LocalDB {
  sessions: Record<string, SessionData>;
  planners: Record<string, PlannerData>;
  users: Record<string, UserRecord>; // normalized_username -> UserRecord
  appPasswordHash?: string;
  appUserPasswordHash?: string;
  groups: Record<string, Group>;
  members: Record<string, Member>;
  tasks: Record<string, Task>;
  taskAssignments: Record<string, TaskAssignment>;
  goals: Record<string, Goal>;
  goalMembers: Record<string, GoalMember>;
  reminders: Record<string, Reminder>;
  notifications: Record<string, Notification>;
  activityLogs: Record<string, ActivityLog>;
  emailPreferences: Record<string, EmailPreferences>;
  userSettings: Record<string, UserSettings>;
}

// Initial DB template
const initialDb: LocalDB = {
  sessions: {},
  planners: {},
  users: {},
  groups: {},
  members: {},
  tasks: {},
  taskAssignments: {},
  goals: {},
  goalMembers: {},
  reminders: {},
  notifications: {},
  activityLogs: {},
  emailPreferences: {},
  userSettings: {}
};

// Check and initialize local db file
export function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
}

// Read database helper
function readLocalDb(): LocalDB {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data) as LocalDB;
    // Backwards compatibility safety check
    if (!parsed.users) parsed.users = {};
    if (!parsed.groups) parsed.groups = {};
    if (!parsed.members) parsed.members = {};
    if (!parsed.tasks) parsed.tasks = {};
    if (!parsed.taskAssignments) parsed.taskAssignments = {};
    if (!parsed.goals) parsed.goals = {};
    if (!parsed.goalMembers) parsed.goalMembers = {};
    if (!parsed.reminders) parsed.reminders = {};
    if (!parsed.notifications) parsed.notifications = {};
    if (!parsed.activityLogs) parsed.activityLogs = {};
    if (!parsed.emailPreferences) parsed.emailPreferences = {};
    if (!parsed.userSettings) parsed.userSettings = {};
    return parsed;
  } catch (err) {
    console.error('Failed to read local DB, using empty template:', err);
    return initialDb;
  }
}

// Write database helper
function writeLocalDb(data: LocalDB) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write to local DB:', err);
  }
}

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

// Sync session data to Supabase
async function syncSessionToSupabase(username: string, session: SessionData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('sessions')
      .upsert({
        username: username.toLowerCase(),
        date: session.date,
        status: session.status,
        work_start: session.workStart,
        work_end: session.workEnd,
        breaks: session.breaks,
        total_break_minutes: session.totalBreakMinutes,
        total_work_minutes: session.totalWorkMinutes,
        effective_work_minutes: session.effectiveWorkMinutes,
        notes: session.notes,
        rating: session.rating,
        completed_tasks: session.completedTasks,
        goals: session.goals
      });

    if (error) {
      throw error;
    }
    return true;
  } catch (error) {
    console.error(`Supabase Session Sync error for date ${session.date} and user ${username}:`, error);
    return false;
  }
}

// Sync planner data to Supabase
async function syncPlannerToSupabase(username: string, planner: PlannerData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('planners')
      .upsert({
        username: username.toLowerCase(),
        date: planner.date,
        goals: planner.goals,
        priorities: planner.priorities,
        checklist: planner.checklist,
        reminders: planner.reminders
      });

    if (error) {
      throw error;
    }
    return true;
  } catch (error) {
    console.error(`Supabase Planner Sync error for date ${planner.date} and user ${username}:`, error);
    return false;
  }
}

// Restore data from Supabase if local database is empty
export async function restoreFromSupabaseIfEmpty() {
  if (!supabase) return;

  try {
    const db = readLocalDb();
    const hasSessions = Object.keys(db.sessions).length > 0;
    const hasPlanners = Object.keys(db.planners).length > 0;
    const hasUsers = Object.keys(db.users).length > 0;

    if (hasSessions && hasPlanners && hasUsers) {
      return;
    }

    console.log('Checking for missing local DB components to restore from Supabase...');
    let modified = false;

    // 1. Restore Users if empty
    if (!hasUsers) {
      console.log('Local users DB is empty. Attempting to restore users from Supabase...');
      const { data: dbUsers, error: usersErr } = await supabase
        .from('users')
        .select('*');

      if (usersErr) {
        console.error('Failed to retrieve users from Supabase:', usersErr);
      } else if (dbUsers && dbUsers.length > 0) {
        const users: Record<string, UserRecord> = {};
        for (const row of dbUsers) {
          users[row.username.toLowerCase()] = {
            username: row.username,
            passwordHash: row.password_hash || undefined,
            role: row.role as 'admin' | 'user',
            name: row.name || undefined
          };
        }
        db.users = users;
        modified = true;
        console.log(`Successfully restored ${Object.keys(users).length} users from Supabase.`);
      }
    }

    // 2. Restore Sessions if empty
    if (!hasSessions) {
      console.log('Local sessions DB is empty. Attempting to restore sessions from Supabase...');
      const { data: dbSessions, error: sessionsErr } = await supabase
        .from('sessions')
        .select('*');

      if (sessionsErr) {
        console.error('Failed to retrieve sessions from Supabase:', sessionsErr);
      } else if (dbSessions && dbSessions.length > 0) {
        const sessions: Record<string, SessionData> = {};
        for (const row of dbSessions) {
          const owner = (row.username || row.role || 'admin').toLowerCase();
          sessions[`${owner}_${row.date}`] = {
            date: row.date,
            status: row.status,
            workStart: row.work_start,
            workEnd: row.work_end,
            breaks: row.breaks || [],
            totalBreakMinutes: row.total_break_minutes || 0,
            totalWorkMinutes: row.total_work_minutes || 0,
            effectiveWorkMinutes: row.effective_work_minutes || 0,
            notes: row.notes || '',
            rating: row.rating || 0,
            completedTasks: row.completed_tasks || [],
            goals: row.goals || [],
            synced: true
          };
        }
        db.sessions = { ...db.sessions, ...sessions };
        modified = true;
        console.log(`Successfully restored ${Object.keys(sessions).length} sessions from Supabase.`);
      }
    }

    // 3. Restore Planners if empty
    if (!hasPlanners) {
      console.log('Local planners DB is empty. Attempting to restore planners from Supabase...');
      const { data: dbPlanners, error: plannersErr } = await supabase
        .from('planners')
        .select('*');

      if (plannersErr) {
        console.error('Failed to retrieve planners from Supabase:', plannersErr);
      } else if (dbPlanners && dbPlanners.length > 0) {
        const planners: Record<string, PlannerData> = {};
        for (const row of dbPlanners) {
          const owner = (row.username || row.role || 'admin').toLowerCase();
          planners[`${owner}_${row.date}`] = {
            date: row.date,
            goals: row.goals || [],
            priorities: row.priorities || [],
            checklist: row.checklist || [],
            reminders: row.reminders || [],
            synced: true
          };
        }
        db.planners = { ...db.planners, ...planners };
        modified = true;
        console.log(`Successfully restored ${Object.keys(planners).length} planners from Supabase.`);
      }
    }

    // 4. Restore Groups if empty
    const hasGroups = Object.keys(db.groups).length > 0;
    if (!hasGroups) {
      console.log('Local groups DB is empty. Attempting to restore groups from Supabase...');
      const { data: dbGroups, error: groupsErr } = await supabase
        .from('groups')
        .select('*');

      if (groupsErr) {
        console.error('Failed to retrieve groups from Supabase:', groupsErr);
      } else if (dbGroups && dbGroups.length > 0) {
        const groups: Record<string, Group> = {};
        for (const row of dbGroups) {
          groups[row.id] = {
            id: row.id,
            name: row.name,
            description: row.description,
            avatar: row.avatar,
            inviteCode: row.invite_code,
            owner: row.owner,
            createdAt: row.created_at,
            settings: row.settings,
            synced: true
          };
        }
        db.groups = groups;
        modified = true;
        console.log(`Successfully restored ${Object.keys(groups).length} groups from Supabase.`);
      }
    }

    // 5. Restore Members if empty
    const hasMembers = Object.keys(db.members).length > 0;
    if (!hasMembers) {
      console.log('Local members DB is empty. Attempting to restore members from Supabase...');
      const { data: dbMembers, error: membersErr } = await supabase
        .from('members')
        .select('*');

      if (membersErr) {
        console.error('Failed to retrieve members from Supabase:', membersErr);
      } else if (dbMembers && dbMembers.length > 0) {
        const members: Record<string, Member> = {};
        for (const row of dbMembers) {
          members[row.id] = {
            id: row.id,
            groupId: row.group_id,
            username: row.username,
            role: row.role as any,
            joinedAt: row.joined_at,
            synced: true
          };
        }
        db.members = members;
        modified = true;
        console.log(`Successfully restored ${Object.keys(members).length} members from Supabase.`);
      }
    }

    // 6. Restore Tasks if empty
    const hasTasks = Object.keys(db.tasks).length > 0;
    if (!hasTasks) {
      console.log('Local tasks DB is empty. Attempting to restore tasks from Supabase...');
      const { data: dbTasks, error: tasksErr } = await supabase
        .from('tasks')
        .select('*');

      if (tasksErr) {
        console.error('Failed to retrieve tasks from Supabase:', tasksErr);
      } else if (dbTasks && dbTasks.length > 0) {
        const tasks: Record<string, Task> = {};
        for (const row of dbTasks) {
          tasks[row.id] = {
            id: row.id,
            groupId: row.group_id,
            title: row.title,
            description: row.description,
            priority: row.priority as any,
            status: row.status as any,
            dueDate: row.due_date,
            createdBy: row.created_by,
            tags: row.tags || [],
            attachments: row.attachments || [],
            repeatOption: row.repeat_option as any,
            checklist: row.checklist || [],
            progress: row.progress || 0,
            createdAt: row.created_at,
            synced: true
          };
        }
        db.tasks = tasks;
        modified = true;
        console.log(`Successfully restored ${Object.keys(tasks).length} tasks from Supabase.`);
      }
    }

    // 7. Restore Task Assignments if empty
    const hasTaskAssignments = Object.keys(db.taskAssignments).length > 0;
    if (!hasTaskAssignments) {
      console.log('Local task assignments DB is empty. Attempting to restore from Supabase...');
      const { data: dbAssign, error: assignErr } = await supabase
        .from('task_assignments')
        .select('*');

      if (assignErr) {
        console.error('Failed to retrieve task assignments from Supabase:', assignErr);
      } else if (dbAssign && dbAssign.length > 0) {
        const assign: Record<string, TaskAssignment> = {};
        for (const row of dbAssign) {
          assign[row.id] = {
            id: row.id,
            taskId: row.task_id,
            username: row.username,
            synced: true
          };
        }
        db.taskAssignments = assign;
        modified = true;
        console.log(`Successfully restored ${Object.keys(assign).length} task assignments from Supabase.`);
      }
    }

    // 8. Restore Goals if empty
    const hasGoals = Object.keys(db.goals).length > 0;
    if (!hasGoals) {
      console.log('Local goals DB is empty. Attempting to restore goals from Supabase...');
      const { data: dbGoals, error: goalsErr } = await supabase
        .from('goals')
        .select('*');

      if (goalsErr) {
        console.error('Failed to retrieve goals from Supabase:', goalsErr);
      } else if (dbGoals && dbGoals.length > 0) {
        const goals: Record<string, Goal> = {};
        for (const row of dbGoals) {
          goals[row.id] = {
            id: row.id,
            groupId: row.group_id,
            title: row.title,
            description: row.description,
            deadline: row.deadline,
            milestones: row.milestones || [],
            progress: Number(row.progress || 0),
            completionPercent: Number(row.completion_percent || 0),
            createdAt: row.created_at,
            synced: true
          };
        }
        db.goals = goals;
        modified = true;
        console.log(`Successfully restored ${Object.keys(goals).length} goals from Supabase.`);
      }
    }

    // 9. Restore Goal Members if empty
    const hasGoalMembers = Object.keys(db.goalMembers).length > 0;
    if (!hasGoalMembers) {
      console.log('Local goal members DB is empty. Attempting to restore from Supabase...');
      const { data: dbGoalMembers, error: goalMembersErr } = await supabase
        .from('goal_members')
        .select('*');

      if (goalMembersErr) {
        console.error('Failed to retrieve goal members from Supabase:', goalMembersErr);
      } else if (dbGoalMembers && dbGoalMembers.length > 0) {
        const goalMembers: Record<string, GoalMember> = {};
        for (const row of dbGoalMembers) {
          goalMembers[row.id] = {
            id: row.id,
            goalId: row.goal_id,
            username: row.username,
            synced: true
          };
        }
        db.goalMembers = goalMembers;
        modified = true;
        console.log(`Successfully restored ${Object.keys(goalMembers).length} goal members from Supabase.`);
      }
    }

    // 10. Restore Reminders if empty
    const hasReminders = Object.keys(db.reminders).length > 0;
    if (!hasReminders) {
      console.log('Local reminders DB is empty. Attempting to restore reminders from Supabase...');
      const { data: dbReminders, error: remindersErr } = await supabase
        .from('reminders')
        .select('*');

      if (remindersErr) {
        console.error('Failed to retrieve reminders from Supabase:', remindersErr);
      } else if (dbReminders && dbReminders.length > 0) {
        const reminders: Record<string, Reminder> = {};
        for (const row of dbReminders) {
          reminders[row.id] = {
            id: row.id,
            userId: row.user_id,
            type: row.type as any,
            targetId: row.target_id || undefined,
            title: row.title,
            message: row.message || '',
            recurrence: row.recurrence as any,
            timing: row.timing || [],
            triggerTimes: row.trigger_times || [],
            lastTriggered: row.last_triggered || null,
            createdAt: row.created_at,
            synced: true
          };
        }
        db.reminders = reminders;
        modified = true;
        console.log(`Successfully restored ${Object.keys(reminders).length} reminders from Supabase.`);
      }
    }

    // 11. Restore Notifications if empty
    const hasNotifications = Object.keys(db.notifications).length > 0;
    if (!hasNotifications) {
      console.log('Local notifications DB is empty. Attempting to restore from Supabase...');
      const { data: dbNotif, error: notifErr } = await supabase
        .from('notifications')
        .select('*');

      if (notifErr) {
        console.error('Failed to retrieve notifications from Supabase:', notifErr);
      } else if (dbNotif && dbNotif.length > 0) {
        const notifications: Record<string, Notification> = {};
        for (const row of dbNotif) {
          notifications[row.id] = {
            id: row.id,
            username: row.username,
            type: row.type as any,
            title: row.title,
            description: row.description || '',
            read: row.read || false,
            createdAt: row.created_at,
            category: row.category || 'general',
            priority: row.priority as any,
            metadata: row.metadata || {},
            synced: true
          };
        }
        db.notifications = notifications;
        modified = true;
        console.log(`Successfully restored ${Object.keys(notifications).length} notifications from Supabase.`);
      }
    }

    if (modified) {
      writeLocalDb(db);
    }
  } catch (error) {
    console.error('Failed to restore data from Supabase:', error);
  }
}

// User Profile Directory CRUD helper
export async function getUser(username: string): Promise<UserRecord | null> {
  const db = readLocalDb();
  return db.users[username.toLowerCase()] || null;
}

export async function saveUser(username: string, user: UserRecord): Promise<UserRecord> {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  const userToSave = { ...user, synced: false };
  db.users[normUser] = userToSave;
  writeLocalDb(db);

  if (supabase) {
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          username: normUser,
          password_hash: user.passwordHash || null,
          role: user.role,
          name: user.name || null,
          email: user.email || null,
          timezone: user.timezone || 'UTC',
          email_verified: user.emailVerified || false
        });
      if (!error) {
        const currentDb = readLocalDb();
        if (currentDb.users[normUser]) {
          currentDb.users[normUser].synced = true;
          writeLocalDb(currentDb);
        }
      }
    } catch (err) {
      console.error(`Supabase User Sync error for ${normUser}:`, err);
    }
  }

  return userToSave;
}

export function getAllUsers(): UserRecord[] {
  const db = readLocalDb();
  return Object.values(db.users);
}

// Session CRUD functions
export async function getSession(username: string, date: string): Promise<SessionData | null> {
  const db = readLocalDb();
  return db.sessions[`${username.toLowerCase()}_${date}`] || null;
}

export async function saveSession(username: string, date: string, session: SessionData): Promise<SessionData> {
  const db = readLocalDb();
  const owner = username.toLowerCase();
  const key = `${owner}_${date}`;
  
  // Save locally first immediately to be fast and offline-resilient
  const sessionToSave = { ...session, synced: false };
  db.sessions[key] = sessionToSave;
  writeLocalDb(db);

  // Sync to Supabase in the background asynchronously without blocking the user response
  if (supabase) {
    syncSessionToSupabase(owner, session).then((synced) => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.sessions[key]) {
          currentDb.sessions[key].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => {
      console.error('Background Supabase session sync error:', err);
    });
  }

  return sessionToSave;
}

export function getAllSessions(username?: string): SessionData[] {
  const db = readLocalDb();
  if (username) {
    const owner = username.toLowerCase();
    return Object.entries(db.sessions)
      .filter(([key]) => key.startsWith(`${owner}_`))
      .map(([_, val]) => val);
  }
  
  return Object.entries(db.sessions).map(([key, val]) => {
    // Backwards compatibility logic
    if (!key.includes('_')) {
      return { ...val, date: key };
    }
    return val;
  });
}

// Planner CRUD functions
export async function getPlanner(username: string, date: string): Promise<PlannerData | null> {
  const db = readLocalDb();
  return db.planners[`${username.toLowerCase()}_${date}`] || null;
}

export async function savePlanner(username: string, date: string, planner: PlannerData): Promise<PlannerData> {
  const db = readLocalDb();
  const owner = username.toLowerCase();
  const key = `${owner}_${date}`;
  
  // Save locally first immediately to be fast and offline-resilient
  const plannerToSave = { ...planner, synced: false };
  db.planners[key] = plannerToSave;
  writeLocalDb(db);

  // Sync to Supabase in the background asynchronously without blocking the user response
  if (supabase) {
    syncPlannerToSupabase(owner, planner).then((synced) => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.planners[key]) {
          currentDb.planners[key].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => {
      console.error('Background Supabase planner sync error:', err);
    });
  }

  return plannerToSave;
}

export function getAllPlanners(username?: string): PlannerData[] {
  const db = readLocalDb();
  if (username) {
    const owner = username.toLowerCase();
    return Object.entries(db.planners)
      .filter(([key]) => key.startsWith(`${owner}_`))
      .map(([_, val]) => val);
  }
  return Object.values(db.planners);
}

// Legacy User Password Storage fallbacks
export function getSavedPasswordHash(): string | null {
  const db = readLocalDb();
  return db.appPasswordHash || null;
}

export function savePasswordHash(hash: string) {
  const db = readLocalDb();
  db.appPasswordHash = hash;
  writeLocalDb(db);
}

export function getSavedUserPasswordHash(): string | null {
  const db = readLocalDb();
  return db.appUserPasswordHash || null;
}

export function saveUserPasswordHash(hash: string) {
  const db = readLocalDb();
  db.appUserPasswordHash = hash;
  writeLocalDb(db);
}

// Supabase synchronization helpers
async function syncGroupToSupabase(group: Group): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('groups').upsert({
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      invite_code: group.inviteCode,
      owner: group.owner.toLowerCase(),
      created_at: group.createdAt,
      settings: group.settings || {}
    });
    return !error;
  } catch (err) {
    console.error('Group sync error:', err);
    return false;
  }
}

async function syncMemberToSupabase(member: Member): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('members').upsert({
      id: member.id,
      group_id: member.groupId,
      username: member.username.toLowerCase(),
      role: member.role,
      joined_at: member.joinedAt
    });
    return !error;
  } catch (err) {
    console.error('Member sync error:', err);
    return false;
  }
}

async function syncTaskToSupabase(task: Task): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('tasks').upsert({
      id: task.id,
      group_id: task.groupId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      due_date: task.dueDate,
      created_by: task.createdBy.toLowerCase(),
      tags: task.tags,
      attachments: task.attachments,
      repeat_option: task.repeatOption,
      checklist: task.checklist,
      progress: task.progress,
      created_at: task.createdAt
    });
    return !error;
  } catch (err) {
    console.error('Task sync error:', err);
    return false;
  }
}

async function syncTaskAssignmentToSupabase(assign: TaskAssignment): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('task_assignments').upsert({
      id: assign.id,
      task_id: assign.taskId,
      username: assign.username.toLowerCase()
    });
    return !error;
  } catch (err) {
    console.error('Assignment sync error:', err);
    return false;
  }
}

async function syncGoalToSupabase(goal: Goal): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('goals').upsert({
      id: goal.id,
      group_id: goal.groupId,
      title: goal.title,
      description: goal.description,
      deadline: goal.deadline,
      milestones: goal.milestones,
      progress: goal.progress,
      completion_percent: goal.completionPercent,
      created_at: goal.createdAt
    });
    return !error;
  } catch (err) {
    console.error('Goal sync error:', err);
    return false;
  }
}

async function syncGoalMemberToSupabase(member: GoalMember): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('goal_members').upsert({
      id: member.id,
      goal_id: member.goalId,
      username: member.username.toLowerCase()
    });
    return !error;
  } catch (err) {
    console.error('Goal member sync error:', err);
    return false;
  }
}

async function syncReminderToSupabase(rem: Reminder): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('reminders').upsert({
      id: rem.id,
      user_id: rem.userId.toLowerCase(),
      type: rem.type,
      target_id: rem.targetId || null,
      title: rem.title,
      message: rem.message,
      recurrence: rem.recurrence,
      timing: rem.timing,
      trigger_times: rem.triggerTimes,
      last_triggered: rem.lastTriggered || null,
      created_at: rem.createdAt
    });
    return !error;
  } catch (err) {
    console.error('Reminder sync error:', err);
    return false;
  }
}

async function syncNotificationToSupabase(notif: Notification): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('notifications').upsert({
      id: notif.id,
      username: notif.username.toLowerCase(),
      type: notif.type,
      title: notif.title,
      description: notif.description,
      read: notif.read,
      created_at: notif.createdAt,
      category: notif.category,
      priority: notif.priority,
      metadata: notif.metadata || {}
    });
    return !error;
  } catch (err) {
    console.error('Notification sync error:', err);
    return false;
  }
}

async function syncActivityLogToSupabase(log: ActivityLog): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('activity_logs').upsert({
      id: log.id,
      group_id: log.groupId || null,
      username: log.username.toLowerCase(),
      action: log.action,
      target_id: log.targetId || null,
      target_type: log.targetType || null,
      created_at: log.createdAt
    });
    return !error;
  } catch (err) {
    console.error('Activity log sync error:', err);
    return false;
  }
}

async function syncEmailPreferencesToSupabase(prefs: EmailPreferences): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('email_preferences').upsert({
      username: prefs.username.toLowerCase(),
      receive_reminder_emails: prefs.receiveReminderEmails,
      receive_task_emails: prefs.receiveTaskEmails,
      receive_goal_emails: prefs.receiveGoalEmails,
      receive_weekly_reports: prefs.receiveWeeklyReports,
      receive_ai_reports: prefs.receiveAiReports,
      receive_marketing_emails: prefs.receiveMarketingEmails,
      enable_dnd: prefs.enableDND,
      quiet_hours_start: prefs.quietHoursStart,
      quiet_hours_end: prefs.quietHoursEnd
    });
    return !error;
  } catch (err) {
    console.error('Email preferences sync error:', err);
    return false;
  }
}

async function syncUserSettingsToSupabase(settings: UserSettings): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('user_settings').upsert({
      username: settings.username.toLowerCase(),
      theme: settings.theme,
      offline_fallback: settings.offlineFallback
    });
    return !error;
  } catch (err) {
    console.error('User settings sync error:', err);
    return false;
  }
}

// Groups CRUD
export async function getGroup(id: string): Promise<Group | null> {
  const db = readLocalDb();
  return db.groups[id] || null;
}

export async function saveGroup(id: string, group: Group): Promise<Group> {
  const db = readLocalDb();
  const groupToSave = { ...group, synced: false };
  db.groups[id] = groupToSave;
  writeLocalDb(db);

  if (supabase) {
    syncGroupToSupabase(group).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.groups[id]) {
          currentDb.groups[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg group sync error:', err));
  }

  return groupToSave;
}

export function getAllGroups(): Group[] {
  const db = readLocalDb();
  return Object.values(db.groups);
}

export async function deleteGroup(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.groups[id]) {
    delete db.groups[id];
    
    // Cascading delete members, tasks, goals
    for (const mId of Object.keys(db.members)) {
      if (db.members[mId].groupId === id) {
        delete db.members[mId];
      }
    }
    for (const tId of Object.keys(db.tasks)) {
      if (db.tasks[tId].groupId === id) {
        delete db.tasks[tId];
      }
    }
    for (const gId of Object.keys(db.goals)) {
      if (db.goals[gId].groupId === id) {
        delete db.goals[gId];
      }
    }
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('groups').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase group delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// Members CRUD
export async function getMember(id: string): Promise<Member | null> {
  const db = readLocalDb();
  return db.members[id] || null;
}

export async function saveMember(id: string, member: Member): Promise<Member> {
  const db = readLocalDb();
  const memberToSave = { ...member, synced: false };
  db.members[id] = memberToSave;
  writeLocalDb(db);

  if (supabase) {
    syncMemberToSupabase(member).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.members[id]) {
          currentDb.members[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg member sync error:', err));
  }

  return memberToSave;
}

export function getGroupMembers(groupId: string): Member[] {
  const db = readLocalDb();
  return Object.values(db.members).filter(m => m.groupId === groupId);
}

export async function deleteMember(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.members[id]) {
    delete db.members[id];
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('members').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase member delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// Tasks CRUD
export async function getTask(id: string): Promise<Task | null> {
  const db = readLocalDb();
  return db.tasks[id] || null;
}

export async function saveTask(id: string, task: Task): Promise<Task> {
  const db = readLocalDb();
  const taskToSave = { ...task, synced: false };
  db.tasks[id] = taskToSave;
  writeLocalDb(db);

  if (supabase) {
    syncTaskToSupabase(task).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.tasks[id]) {
          currentDb.tasks[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg task sync error:', err));
  }

  return taskToSave;
}

export function getGroupTasks(groupId: string): Task[] {
  const db = readLocalDb();
  return Object.values(db.tasks).filter(t => t.groupId === groupId);
}

export function getUserTasks(username: string): Task[] {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  const assignedTaskIds = new Set(
    Object.values(db.taskAssignments)
      .filter(a => a.username.toLowerCase() === normUser)
      .map(a => a.taskId)
  );
  return Object.values(db.tasks).filter(t => t.createdBy.toLowerCase() === normUser || assignedTaskIds.has(t.id));
}

export function getAllTasks(): Task[] {
  const db = readLocalDb();
  return Object.values(db.tasks);
}

export async function deleteTask(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.tasks[id]) {
    delete db.tasks[id];
    // Delete associated assignments
    for (const aId of Object.keys(db.taskAssignments)) {
      if (db.taskAssignments[aId].taskId === id) {
        delete db.taskAssignments[aId];
      }
    }
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('tasks').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase task delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// TaskAssignments CRUD
export async function saveTaskAssignment(id: string, assignment: TaskAssignment): Promise<TaskAssignment> {
  const db = readLocalDb();
  const assignToSave = { ...assignment, synced: false };
  db.taskAssignments[id] = assignToSave;
  writeLocalDb(db);

  if (supabase) {
    syncTaskAssignmentToSupabase(assignment).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.taskAssignments[id]) {
          currentDb.taskAssignments[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg assignment sync error:', err));
  }

  return assignToSave;
}

export function getTaskAssignments(taskId: string): TaskAssignment[] {
  const db = readLocalDb();
  return Object.values(db.taskAssignments).filter(a => a.taskId === taskId);
}

export async function deleteTaskAssignment(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.taskAssignments[id]) {
    delete db.taskAssignments[id];
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('task_assignments').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase assignment delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// Goals CRUD
export async function getGoal(id: string): Promise<Goal | null> {
  const db = readLocalDb();
  return db.goals[id] || null;
}

export async function saveGoal(id: string, goal: Goal): Promise<Goal> {
  const db = readLocalDb();
  const goalToSave = { ...goal, synced: false };
  db.goals[id] = goalToSave;
  writeLocalDb(db);

  if (supabase) {
    syncGoalToSupabase(goal).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.goals[id]) {
          currentDb.goals[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg goal sync error:', err));
  }

  return goalToSave;
}

export function getGroupGoals(groupId: string): Goal[] {
  const db = readLocalDb();
  return Object.values(db.goals).filter(g => g.groupId === groupId);
}

export async function deleteGoal(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.goals[id]) {
    delete db.goals[id];
    // Delete goal members
    for (const gmId of Object.keys(db.goalMembers)) {
      if (db.goalMembers[gmId].goalId === id) {
        delete db.goalMembers[gmId];
      }
    }
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('goals').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase goal delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// GoalMembers CRUD
export async function saveGoalMember(id: string, member: GoalMember): Promise<GoalMember> {
  const db = readLocalDb();
  const gmToSave = { ...member, synced: false };
  db.goalMembers[id] = gmToSave;
  writeLocalDb(db);

  if (supabase) {
    syncGoalMemberToSupabase(member).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.goalMembers[id]) {
          currentDb.goalMembers[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg goal member sync error:', err));
  }

  return gmToSave;
}

export function getGoalMembers(goalId: string): GoalMember[] {
  const db = readLocalDb();
  return Object.values(db.goalMembers).filter(gm => gm.goalId === goalId);
}

export async function deleteGoalMember(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.goalMembers[id]) {
    delete db.goalMembers[id];
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('goal_members').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase goal member delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// Reminders CRUD
export async function getReminder(id: string): Promise<Reminder | null> {
  const db = readLocalDb();
  return db.reminders[id] || null;
}

export async function saveReminder(id: string, reminder: Reminder): Promise<Reminder> {
  const db = readLocalDb();
  const reminderToSave = { ...reminder, synced: false };
  db.reminders[id] = reminderToSave;
  writeLocalDb(db);

  if (supabase) {
    syncReminderToSupabase(reminder).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.reminders[id]) {
          currentDb.reminders[id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg reminder sync error:', err));
  }

  return reminderToSave;
}

export function getUserReminders(username: string): Reminder[] {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  return Object.values(db.reminders).filter(r => r.userId.toLowerCase() === normUser);
}

export function getAllReminders(): Reminder[] {
  const db = readLocalDb();
  return Object.values(db.reminders);
}

export async function deleteReminder(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.reminders[id]) {
    delete db.reminders[id];
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('reminders').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase reminder delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// Notifications CRUD
export async function getNotification(id: string): Promise<Notification | null> {
  const db = readLocalDb();
  return db.notifications[id] || null;
}

export async function saveNotification(id: string, notification: Notification): Promise<Notification> {
  const db = readLocalDb();
  const notificationToSave = { ...notification, synced: false };
  db.notifications[notification.id] = notificationToSave;
  writeLocalDb(db);

  if (supabase) {
    syncNotificationToSupabase(notification).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.notifications[notification.id]) {
          currentDb.notifications[notification.id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg notification sync error:', err));
  }

  return notificationToSave;
}

export function getUserNotifications(username: string): Notification[] {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  return Object.values(db.notifications).filter(n => n.username.toLowerCase() === normUser);
}

export async function deleteNotification(id: string): Promise<boolean> {
  const db = readLocalDb();
  if (db.notifications[id]) {
    delete db.notifications[id];
    writeLocalDb(db);

    if (supabase) {
      try {
        await supabase.from('notifications').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase notification delete error:', err);
      }
    }
    return true;
  }
  return false;
}

// ActivityLogs CRUD
export async function saveActivityLog(id: string, log: ActivityLog): Promise<ActivityLog> {
  const db = readLocalDb();
  const logToSave = { ...log, synced: false };
  db.activityLogs[log.id] = logToSave;
  writeLocalDb(db);

  if (supabase) {
    syncActivityLogToSupabase(log).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.activityLogs[log.id]) {
          currentDb.activityLogs[log.id].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg activity log sync error:', err));
  }

  return logToSave;
}

export function getGroupActivityLogs(groupId: string): ActivityLog[] {
  const db = readLocalDb();
  return Object.values(db.activityLogs).filter(l => l.groupId === groupId);
}

// Email Preferences CRUD
export async function getEmailPreferences(username: string): Promise<EmailPreferences | null> {
  const db = readLocalDb();
  return db.emailPreferences[username.toLowerCase()] || null;
}

export async function saveEmailPreferences(username: string, prefs: EmailPreferences): Promise<EmailPreferences> {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  const prefsToSave = { ...prefs, synced: false };
  db.emailPreferences[normUser] = prefsToSave;
  writeLocalDb(db);

  if (supabase) {
    syncEmailPreferencesToSupabase(prefs).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.emailPreferences[normUser]) {
          currentDb.emailPreferences[normUser].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg email preferences sync error:', err));
  }

  return prefsToSave;
}

// User Settings CRUD
export async function getUserSettings(username: string): Promise<UserSettings | null> {
  const db = readLocalDb();
  return db.userSettings[username.toLowerCase()] || null;
}

export async function saveUserSettings(username: string, settings: UserSettings): Promise<UserSettings> {
  const db = readLocalDb();
  const normUser = username.toLowerCase();
  const settingsToSave = { ...settings, synced: false };
  db.userSettings[normUser] = settingsToSave;
  writeLocalDb(db);

  if (supabase) {
    syncUserSettingsToSupabase(settings).then(synced => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.userSettings[normUser]) {
          currentDb.userSettings[normUser].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => console.error('Bg settings sync error:', err));
  }

  return settingsToSave;
}

// Automatically retry and push any unsynced background queue data
export async function retryUnsyncedData() {
  if (!supabase) return;

  const db = readLocalDb();
  let modified = false;

  // 1. Retry sessions
  for (const [key, session] of Object.entries(db.sessions)) {
    if (!session.synced) {
      const parts = key.split('_');
      const activeOwner = parts.length > 1 ? parts[0] : 'admin';
      const activeDate = parts.length > 1 ? parts[1] : key;

      console.log(`Retrying sync for session on date: ${activeDate} and user: ${activeOwner}`);
      const synced = await syncSessionToSupabase(activeOwner, session);
      if (synced) {
        db.sessions[key].synced = true;
        modified = true;
      }
    }
  }

  // 2. Retry planners
  for (const [key, planner] of Object.entries(db.planners)) {
    if (!planner.synced) {
      const parts = key.split('_');
      const activeOwner = parts.length > 1 ? parts[0] : 'admin';
      const activeDate = parts.length > 1 ? parts[1] : key;

      console.log(`Retrying sync for planner on date: ${activeDate} and user: ${activeOwner}`);
      const synced = await syncPlannerToSupabase(activeOwner, planner);
      if (synced) {
        db.planners[key].synced = true;
        modified = true;
      }
    }
  }

  // 3. Retry Users
  for (const [key, u] of Object.entries(db.users)) {
    if (!u.synced) {
      console.log(`Retrying sync for user: ${key}`);
      try {
        const { error } = await supabase.from('users').upsert({
          username: key,
          password_hash: u.passwordHash || null,
          role: u.role,
          name: u.name || null,
          email: u.email || null,
          timezone: u.timezone || 'UTC',
          email_verified: u.emailVerified || false
        });
        if (!error) {
          db.users[key].synced = true;
          modified = true;
        }
      } catch (err) {
        console.error('Retrying user sync error:', err);
      }
    }
  }

  // 4. Retry Groups
  for (const [key, g] of Object.entries(db.groups)) {
    if (!g.synced) {
      console.log(`Retrying sync for group: ${key}`);
      const synced = await syncGroupToSupabase(g);
      if (synced) {
        db.groups[key].synced = true;
        modified = true;
      }
    }
  }

  // 5. Retry Members
  for (const [key, m] of Object.entries(db.members)) {
    if (!m.synced) {
      console.log(`Retrying sync for member: ${key}`);
      const synced = await syncMemberToSupabase(m);
      if (synced) {
        db.members[key].synced = true;
        modified = true;
      }
    }
  }

  // 6. Retry Tasks
  for (const [key, t] of Object.entries(db.tasks)) {
    if (!t.synced) {
      console.log(`Retrying sync for task: ${key}`);
      const synced = await syncTaskToSupabase(t);
      if (synced) {
        db.tasks[key].synced = true;
        modified = true;
      }
    }
  }

  // 7. Retry Task Assignments
  for (const [key, ta] of Object.entries(db.taskAssignments)) {
    if (!ta.synced) {
      console.log(`Retrying sync for assignment: ${key}`);
      const synced = await syncTaskAssignmentToSupabase(ta);
      if (synced) {
        db.taskAssignments[key].synced = true;
        modified = true;
      }
    }
  }

  // 8. Retry Goals
  for (const [key, goal] of Object.entries(db.goals)) {
    if (!goal.synced) {
      console.log(`Retrying sync for goal: ${key}`);
      const synced = await syncGoalToSupabase(goal);
      if (synced) {
        db.goals[key].synced = true;
        modified = true;
      }
    }
  }

  // 9. Retry Goal Members
  for (const [key, gm] of Object.entries(db.goalMembers)) {
    if (!gm.synced) {
      console.log(`Retrying sync for goal member: ${key}`);
      const synced = await syncGoalMemberToSupabase(gm);
      if (synced) {
        db.goalMembers[key].synced = true;
        modified = true;
      }
    }
  }

  // 10. Retry Reminders
  for (const [key, r] of Object.entries(db.reminders)) {
    if (!r.synced) {
      console.log(`Retrying sync for reminder: ${key}`);
      const synced = await syncReminderToSupabase(r);
      if (synced) {
        db.reminders[key].synced = true;
        modified = true;
      }
    }
  }

  // 11. Retry Notifications
  for (const [key, n] of Object.entries(db.notifications)) {
    if (!n.synced) {
      console.log(`Retrying sync for notification: ${key}`);
      const synced = await syncNotificationToSupabase(n);
      if (synced) {
        db.notifications[key].synced = true;
        modified = true;
      }
    }
  }

  // 12. Retry Activity Logs
  for (const [key, al] of Object.entries(db.activityLogs)) {
    if (!al.synced) {
      console.log(`Retrying sync for activity log: ${key}`);
      const synced = await syncActivityLogToSupabase(al);
      if (synced) {
        db.activityLogs[key].synced = true;
        modified = true;
      }
    }
  }

  // 13. Retry Email Preferences
  for (const [key, ep] of Object.entries(db.emailPreferences)) {
    if (!ep.synced) {
      console.log(`Retrying sync for email preferences: ${key}`);
      const synced = await syncEmailPreferencesToSupabase(ep);
      if (synced) {
        db.emailPreferences[key].synced = true;
        modified = true;
      }
    }
  }

  // 14. Retry User Settings
  for (const [key, us] of Object.entries(db.userSettings)) {
    if (!us.synced) {
      console.log(`Retrying sync for user settings: ${key}`);
      const synced = await syncUserSettingsToSupabase(us);
      if (synced) {
        db.userSettings[key].synced = true;
        modified = true;
      }
    }
  }

  if (modified) {
    writeLocalDb(db);
    console.log('Unsynced background queue records successfully synchronized.');
  }
}
