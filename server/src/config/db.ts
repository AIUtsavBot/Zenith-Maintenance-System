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
}

interface LocalDB {
  sessions: Record<string, SessionData>;
  planners: Record<string, PlannerData>;
  users: Record<string, UserRecord>; // normalized_username -> UserRecord
  appPasswordHash?: string;
  appUserPasswordHash?: string;
}

// Initial DB template
const initialDb: LocalDB = {
  sessions: {},
  planners: {},
  users: {}
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
    if (!parsed.users) {
      parsed.users = {};
    }
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

    if (hasSessions || hasPlanners || hasUsers) {
      return;
    }

    console.log('Local DB is empty. Attempting to restore data from Supabase...');

    // 1. Restore Users
    const { data: dbUsers, error: usersErr } = await supabase
      .from('users')
      .select('*');

    if (usersErr) throw usersErr;

    // 2. Restore Sessions
    const { data: dbSessions, error: sessionsErr } = await supabase
      .from('sessions')
      .select('*');

    if (sessionsErr) throw sessionsErr;

    // 3. Restore Planners
    const { data: dbPlanners, error: plannersErr } = await supabase
      .from('planners')
      .select('*');

    if (plannersErr) throw plannersErr;

    const users: Record<string, UserRecord> = {};
    if (dbUsers) {
      for (const row of dbUsers) {
        users[row.username.toLowerCase()] = {
          username: row.username,
          passwordHash: row.password_hash || undefined,
          role: row.role as 'admin' | 'user',
          name: row.name || undefined
        };
      }
    }

    const sessions: Record<string, SessionData> = {};
    if (dbSessions) {
      for (const row of dbSessions) {
        // Map user row.username. If missing, fall back to row.role or 'admin'
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
    }

    const planners: Record<string, PlannerData> = {};
    if (dbPlanners) {
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
    }

    db.users = users;
    db.sessions = sessions;
    db.planners = planners;

    writeLocalDb(db);
    console.log(`Successfully restored ${Object.keys(users).length} users, ${Object.keys(sessions).length} sessions, and ${Object.keys(planners).length} planners from Supabase.`);
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
  db.users[normUser] = user;
  writeLocalDb(db);

  if (supabase) {
    try {
      await supabase
        .from('users')
        .upsert({
          username: normUser,
          password_hash: user.passwordHash || null,
          role: user.role,
          name: user.name || null
        });
    } catch (err) {
      console.error(`Supabase User Sync error for ${normUser}:`, err);
    }
  }

  return user;
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

  if (modified) {
    writeLocalDb(db);
    console.log('Unsynced background queue records successfully synchronized.');
  }
}
