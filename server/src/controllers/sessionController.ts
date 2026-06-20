import { Response } from 'express';
import { getSession, saveSession, getAllSessions, SessionData, BreakRecord } from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

// Get today's date string in user's timezone YYYY-MM-DD
function getLocalDateString(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Compute difference in minutes between two ISO date strings
function getMinutesDiff(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / 1000 / 60));
}

// Compute total break minutes for a session
function calculateBreakMinutes(breaks: BreakRecord[], nowStr: string): number {
  return breaks.reduce((total, b) => {
    const end = b.end || nowStr;
    return total + getMinutesDiff(b.start, end);
  }, 0);
}

// Retrieve current session status and detect forgotten sessions
export async function getCurrentSession(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role || 'admin';
    const today = getLocalDateString();
    
    // Find all sessions to check if there is an active session from any date
    const allSessions = getAllSessions(role);
    
    // Sort sessions to find the most recent one
    const sorted = [...allSessions].sort((a, b) => b.date.localeCompare(a.date));
    const activeSession = sorted.find(s => s.status !== 'Offline');

    if (activeSession) {
      // Check if it is a forgotten session (different date OR active for >16 hours)
      const nowStr = new Date().toISOString();
      const hoursActive = getMinutesDiff(activeSession.workStart || nowStr, nowStr) / 60;
      
      if (activeSession.date !== today || hoursActive > 16) {
        return res.json({
          session: activeSession,
          forgotten: true
        });
      }

      return res.json({
        session: activeSession,
        forgotten: false
      });
    }

    // No active session in progress. Let's see if we have a closed session for today.
    const todaySession = await getSession(role, today);
    return res.json({
      session: todaySession, // Can be null (offline) or closed session
      forgotten: false
    });
  } catch (error) {
    console.error('Get current session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Start a new work session
export async function startWork(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role || 'admin';
    const today = getLocalDateString();
    let session = await getSession(role, today);

    if (session && session.status !== 'Offline') {
      return res.status(400).json({ error: 'Work session is already running', session });
    }

    if (session && session.workStart !== null) {
      return res.status(400).json({ error: 'You are only allowed to start one work session per day.', session });
    }

    const nowStr = new Date().toISOString();

    const newSession: SessionData = {
      date: today,
      status: 'Working',
      workStart: nowStr,
      workEnd: null,
      breaks: [],
      totalBreakMinutes: 0,
      totalWorkMinutes: 0,
      effectiveWorkMinutes: 0,
      notes: session?.notes || '',
      rating: session?.rating || 0,
      completedTasks: session?.completedTasks || [],
      goals: session?.goals || []
    };

    const saved = await saveSession(role, today, newSession);
    return res.json({ message: 'Work session started', session: saved });
  } catch (error) {
    console.error('Start work error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Start a break
export async function startBreak(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role || 'admin';
    const today = getLocalDateString();
    
    // Find active session first
    const all = getAllSessions(role);
    const session = all.find(s => s.status !== 'Offline') || await getSession(role, today);

    if (!session) {
      return res.status(400).json({ error: 'No active work session found' });
    }

    if (session.status === 'On Break') {
      return res.status(400).json({ error: 'Session is already on break', session });
    }

    if (session.status !== 'Working') {
      return res.status(400).json({ error: 'Cannot start break when offline/not working', session });
    }

    const nowStr = new Date().toISOString();
    
    session.status = 'On Break';
    session.breaks.push({
      start: nowStr,
      end: null
    });

    const saved = await saveSession(role, session.date, session);
    return res.json({ message: 'Break started', session: saved });
  } catch (error) {
    console.error('Start break error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// End break and return to working status
export async function endBreak(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role || 'admin';
    const today = getLocalDateString();
    const all = getAllSessions(role);
    const session = all.find(s => s.status !== 'Offline') || await getSession(role, today);

    if (!session) {
      return res.status(400).json({ error: 'No active work session found' });
    }

    if (session.status !== 'On Break') {
      return res.status(400).json({ error: 'Session is not currently on break', session });
    }

    const nowStr = new Date().toISOString();
    
    // Find the last break and set its end time
    const lastBreak = session.breaks[session.breaks.length - 1];
    if (lastBreak && !lastBreak.end) {
      lastBreak.end = nowStr;
    }

    session.status = 'Working';
    session.totalBreakMinutes = calculateBreakMinutes(session.breaks, nowStr);

    const saved = await saveSession(role, session.date, session);
    return res.json({ message: 'Break ended', session: saved });
  } catch (error) {
    console.error('End break error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// End work session and finalize totals
export async function endWork(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role || 'admin';
    const today = getLocalDateString();
    const all = getAllSessions(role);
    const session = all.find(s => s.status !== 'Offline') || await getSession(role, today);

    if (!session) {
      return res.status(400).json({ error: 'No active work session found' });
    }

    const nowStr = new Date().toISOString();

    // If session is on break, end the break first
    if (session.status === 'On Break') {
      const lastBreak = session.breaks[session.breaks.length - 1];
      if (lastBreak && !lastBreak.end) {
        lastBreak.end = nowStr;
      }
    }

    session.status = 'Offline';
    session.workEnd = nowStr;

    // Recalculate totals
    const startStr = session.workStart || nowStr;
    session.totalBreakMinutes = calculateBreakMinutes(session.breaks, nowStr);
    session.totalWorkMinutes = getMinutesDiff(startStr, nowStr);
    session.effectiveWorkMinutes = Math.max(0, session.totalWorkMinutes - session.totalBreakMinutes);

    const saved = await saveSession(role, session.date, session);
    return res.json({ message: 'Work session ended', session: saved });
  } catch (error) {
    console.error('End work error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Resolve a forgotten active session
export async function resolveForgottenSession(req: AuthenticatedRequest, res: Response) {
  const { action, customEndTime } = req.body; // action: 'close' | 'discard'
  const today = getLocalDateString();
  const role = req.user?.role || 'admin';

  try {
    const all = getAllSessions(role);
    const forgottenSession = all.find(s => s.status !== 'Offline' && s.date !== today);

    if (!forgottenSession) {
      return res.status(400).json({ error: 'No forgotten active session found' });
    }

    if (action === 'discard') {
      // Discard by removing or setting status to Offline with zero hours
      forgottenSession.status = 'Offline';
      forgottenSession.workEnd = forgottenSession.workStart;
      forgottenSession.totalBreakMinutes = 0;
      forgottenSession.totalWorkMinutes = 0;
      forgottenSession.effectiveWorkMinutes = 0;
      forgottenSession.notes = forgottenSession.notes || 'Session discarded';
      
      const saved = await saveSession(role, forgottenSession.date, forgottenSession);
      return res.json({ message: 'Session discarded successfully', session: saved });
    }

    if (action === 'close') {
      let endTimestamp = '';
      if (customEndTime) {
        // customEndTime can be a string representing time e.g., '17:00' or an ISO timestamp
        if (customEndTime.includes('T')) {
          endTimestamp = customEndTime;
        } else {
          // Reconstruct timestamp from session date and time string
          const [hrs, mins] = customEndTime.split(':');
          const dateObj = new Date(forgottenSession.workStart || new Date());
          dateObj.setHours(parseInt(hrs, 10), parseInt(mins, 10), 0);
          endTimestamp = dateObj.toISOString();
        }
      } else {
        // Fallback: close 8 hours after start
        const dateObj = new Date(forgottenSession.workStart || new Date());
        dateObj.setHours(dateObj.getHours() + 8);
        endTimestamp = dateObj.toISOString();
      }

      // Close all active breaks
      forgottenSession.breaks.forEach(b => {
        if (!b.end) b.end = endTimestamp;
      });

      forgottenSession.status = 'Offline';
      forgottenSession.workEnd = endTimestamp;

      const startStr = forgottenSession.workStart || endTimestamp;
      forgottenSession.totalBreakMinutes = calculateBreakMinutes(forgottenSession.breaks, endTimestamp);
      forgottenSession.totalWorkMinutes = getMinutesDiff(startStr, endTimestamp);
      forgottenSession.effectiveWorkMinutes = Math.max(0, forgottenSession.totalWorkMinutes - forgottenSession.totalBreakMinutes);

      const saved = await saveSession(role, forgottenSession.date, forgottenSession);
      return res.json({ message: 'Session closed retroactively', session: saved });
    }

    return res.status(400).json({ error: 'Invalid resolution action. Use "close" or "discard".' });
  } catch (error) {
    console.error('Resolve forgotten session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
