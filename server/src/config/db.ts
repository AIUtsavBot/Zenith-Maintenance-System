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

interface LocalDB {
  sessions: Record<string, SessionData>;
  planners: Record<string, PlannerData>;
  appPasswordHash?: string;
}

// Initial DB template
const initialDb: LocalDB = {
  sessions: {},
  planners: {}
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
    return JSON.parse(data) as LocalDB;
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
async function syncSessionToSupabase(session: SessionData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('sessions')
      .upsert({
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
    console.error(`Supabase Session Sync error for date ${session.date}:`, error);
    return false;
  }
}

// Sync planner data to Supabase
async function syncPlannerToSupabase(planner: PlannerData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('planners')
      .upsert({
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
    console.error(`Supabase Planner Sync error for date ${planner.date}:`, error);
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

    if (hasSessions || hasPlanners) {
      return;
    }

    console.log('Local DB is empty. Attempting to restore data from Supabase...');

    const { data: dbSessions, error: sessionsErr } = await supabase
      .from('sessions')
      .select('*');

    if (sessionsErr) throw sessionsErr;

    const { data: dbPlanners, error: plannersErr } = await supabase
      .from('planners')
      .select('*');

    if (plannersErr) throw plannersErr;

    const sessions: Record<string, SessionData> = {};
    if (dbSessions) {
      for (const row of dbSessions) {
        sessions[row.date] = {
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
        planners[row.date] = {
          date: row.date,
          goals: row.goals || [],
          priorities: row.priorities || [],
          checklist: row.checklist || [],
          reminders: row.reminders || [],
          synced: true
        };
      }
    }

    db.sessions = sessions;
    db.planners = planners;

    writeLocalDb(db);
    console.log(`Successfully restored ${Object.keys(sessions).length} sessions and ${Object.keys(planners).length} planners from Supabase.`);
  } catch (error) {
    console.error('Failed to restore data from Supabase:', error);
  }
}

// Session CRUD functions
export async function getSession(date: string): Promise<SessionData | null> {
  const db = readLocalDb();
  return db.sessions[date] || null;
}

export async function saveSession(date: string, session: SessionData): Promise<SessionData> {
  const db = readLocalDb();
  
  // Save locally first immediately to be fast and offline-resilient
  const sessionToSave = { ...session, synced: false };
  db.sessions[date] = sessionToSave;
  writeLocalDb(db);

  // Sync to Supabase in the background asynchronously without blocking the user response
  if (supabase) {
    syncSessionToSupabase(session).then((synced) => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.sessions[date]) {
          currentDb.sessions[date].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => {
      console.error('Background Supabase session sync error:', err);
    });
  }

  return sessionToSave;
}

export function getAllSessions(): SessionData[] {
  const db = readLocalDb();
  return Object.values(db.sessions);
}

// Planner CRUD functions
export async function getPlanner(date: string): Promise<PlannerData | null> {
  const db = readLocalDb();
  return db.planners[date] || null;
}

export async function savePlanner(date: string, planner: PlannerData): Promise<PlannerData> {
  const db = readLocalDb();
  
  // Save locally first immediately to be fast and offline-resilient
  const plannerToSave = { ...planner, synced: false };
  db.planners[date] = plannerToSave;
  writeLocalDb(db);

  // Sync to Supabase in the background asynchronously without blocking the user response
  if (supabase) {
    syncPlannerToSupabase(planner).then((synced) => {
      if (synced) {
        const currentDb = readLocalDb();
        if (currentDb.planners[date]) {
          currentDb.planners[date].synced = true;
          writeLocalDb(currentDb);
        }
      }
    }).catch(err => {
      console.error('Background Supabase planner sync error:', err);
    });
  }

  return plannerToSave;
}

export function getAllPlanners(): PlannerData[] {
  const db = readLocalDb();
  return Object.values(db.planners);
}

// User Password Storage
export function getSavedPasswordHash(): string | null {
  const db = readLocalDb();
  return db.appPasswordHash || null;
}

export function savePasswordHash(hash: string) {
  const db = readLocalDb();
  db.appPasswordHash = hash;
  writeLocalDb(db);
}

// Automatically retry and push any unsynced background queue data
export async function retryUnsyncedData() {
  if (!supabase) return;

  const db = readLocalDb();
  let modified = false;

  // 1. Retry sessions
  for (const [date, session] of Object.entries(db.sessions)) {
    if (!session.synced) {
      console.log(`Retrying sync for session on date: ${date}`);
      const synced = await syncSessionToSupabase(session);
      if (synced) {
        db.sessions[date].synced = true;
        modified = true;
      }
    }
  }

  // 2. Retry planners
  for (const [date, planner] of Object.entries(db.planners)) {
    if (!planner.synced) {
      console.log(`Retrying sync for planner on date: ${date}`);
      const synced = await syncPlannerToSupabase(planner);
      if (synced) {
        db.planners[date].synced = true;
        modified = true;
      }
    }
  }

  if (modified) {
    writeLocalDb(db);
    console.log('Unsynced background queue records successfully synchronized.');
  }
}
