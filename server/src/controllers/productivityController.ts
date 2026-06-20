import { Response } from 'express';
import { getSession, saveSession, getAllSessions, SessionData, getPlanner, savePlanner, PlannerData } from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

// Helper to get local date string YYYY-MM-DD
function getLocalDateString(offsetDays = 0): string {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Get or create productivity session details for a specific date
export async function getProductivityData(req: AuthenticatedRequest, res: Response) {
  const { date } = req.query;
  const targetDate = (date as string) || getLocalDateString();
  const username = req.user?.username || 'admin';

  try {
    let session = await getSession(username, targetDate);
    
    if (!session) {
      // Return empty structures if offline/not created
      session = {
        date: targetDate,
        status: 'Offline',
        workStart: null,
        workEnd: null,
        breaks: [],
        totalBreakMinutes: 0,
        totalWorkMinutes: 0,
        effectiveWorkMinutes: 0,
        notes: '',
        rating: 0,
        completedTasks: [],
        goals: []
      };
    }
    
    return res.json(session);
  } catch (error) {
    console.error('Get productivity data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update productivity metrics (notes, rating, goals, completedTasks)
export async function updateProductivityData(req: AuthenticatedRequest, res: Response) {
  const { date, notes, rating, completedTasks, goals } = req.body;
  const targetDate = date || getLocalDateString();
  const username = req.user?.username || 'admin';

  try {
    let session = await getSession(username, targetDate);

    if (!session) {
      // Create an offline shell session to hold the notes/rating
      session = {
        date: targetDate,
        status: 'Offline',
        workStart: null,
        workEnd: null,
        breaks: [],
        totalBreakMinutes: 0,
        totalWorkMinutes: 0,
        effectiveWorkMinutes: 0,
        notes: '',
        rating: 0,
        completedTasks: [],
        goals: []
      };
    }

    if (notes !== undefined) session.notes = notes;
    if (rating !== undefined) session.rating = Number(rating);
    if (completedTasks !== undefined) session.completedTasks = completedTasks;
    if (goals !== undefined) session.goals = goals;

    const saved = await saveSession(username, targetDate, session);
    return res.json({ message: 'Productivity notes saved successfully', session: saved });
  } catch (error) {
    console.error('Update productivity data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get planner checklists and goals for a specific date
export async function getPlannerData(req: AuthenticatedRequest, res: Response) {
  const { date } = req.params;
  const targetDate = date || getLocalDateString();
  const username = req.user?.username || 'admin';

  try {
    let planner = await getPlanner(username, targetDate);
    
    if (!planner) {
      planner = {
        date: targetDate,
        goals: [],
        priorities: [],
        checklist: [],
        reminders: []
      };
    }

    return res.json(planner);
  } catch (error) {
    console.error('Get planner error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Save or update planner items
export async function updatePlannerData(req: AuthenticatedRequest, res: Response) {
  const { date } = req.params;
  const { goals, priorities, checklist, reminders } = req.body;
  const targetDate = date || getLocalDateString();
  const username = req.user?.username || 'admin';

  try {
    let planner = await getPlanner(username, targetDate);

    if (!planner) {
      planner = {
        date: targetDate,
        goals: [],
        priorities: [],
        checklist: [],
        reminders: []
      };
    }

    if (goals !== undefined) planner.goals = goals;
    if (priorities !== undefined) planner.priorities = priorities;
    if (checklist !== undefined) planner.checklist = checklist;
    if (reminders !== undefined) planner.reminders = reminders;

    const saved = await savePlanner(username, targetDate, planner);
    return res.json({ message: 'Planner items saved', planner: saved });
  } catch (error) {
    console.error('Update planner error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all session history for Calendar and Charts
export async function getHistory(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username || 'admin';
  try {
    const sessions = getAllSessions(username);
    // Sort in ascending order for historical trends
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    return res.json(sorted);
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get aggregated dashboard stats
export async function getDashboardSummary(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username || 'admin';
  try {
    const today = getLocalDateString();
    const sessions = getAllSessions(username);

    // 1. Today's stats
    const todaySession = sessions.find(s => s.date === today);
    const todayStats = {
      totalWorkHours: todaySession ? (todaySession.totalWorkMinutes / 60) : 0,
      totalBreakHours: todaySession ? (todaySession.totalBreakMinutes / 60) : 0,
      effectiveHours: todaySession ? (todaySession.effectiveWorkMinutes / 60) : 0,
      rating: todaySession ? todaySession.rating : 0
    };

    // 2. Weekly stats (last 7 days from today)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6); // Includes today
    const weekStartDateStr = weekStart.toISOString().split('T')[0];

    const weeklySessions = sessions.filter(s => s.date >= weekStartDateStr && s.date <= today);
    
    let weeklyTotalMinutes = 0;
    let weeklyDaysCount = 0;
    const weeklyData = [];

    // Map each of the last 7 days (even if no session exists) for chart continuity
    for (let i = 6; i >= 0; i--) {
      const dStr = getLocalDateString(-i);
      const s = sessions.find(sess => sess.date === dStr);
      const effHours = s ? Number((s.effectiveWorkMinutes / 60).toFixed(2)) : 0;
      const r = s ? s.rating : 0;

      if (s) {
        weeklyTotalMinutes += s.effectiveWorkMinutes;
        weeklyDaysCount++;
      }

      weeklyData.push({
        date: dStr,
        dayLabel: new Date(dStr).toLocaleDateString(undefined, { weekday: 'short' }),
        effectiveHours: effHours,
        rating: r
      });
    }

    const weeklyStats = {
      totalHours: Number((weeklyTotalMinutes / 60).toFixed(2)),
      avgHours: weeklyDaysCount > 0 ? Number((weeklyTotalMinutes / 60 / weeklyDaysCount).toFixed(2)) : 0,
      chartData: weeklyData
    };

    // 3. Monthly stats (last 30 days)
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 29);
    const monthStartDateStr = monthStart.toISOString().split('T')[0];

    const monthlySessions = sessions.filter(s => s.date >= monthStartDateStr && s.date <= today);

    let monthlyTotalMinutes = 0;
    let totalRatings = 0;
    let ratedDaysCount = 0;
    const monthlyData = [];

    for (let i = 29; i >= 0; i--) {
      const dStr = getLocalDateString(-i);
      const s = sessions.find(sess => sess.date === dStr);
      const effHours = s ? Number((s.effectiveWorkMinutes / 60).toFixed(2)) : 0;
      const r = s ? s.rating : 0;

      if (s) {
        monthlyTotalMinutes += s.effectiveWorkMinutes;
        if (s.rating > 0) {
          totalRatings += s.rating;
          ratedDaysCount++;
        }
      }

      monthlyData.push({
        date: dStr,
        dayNumber: new Date(dStr).getDate(),
        effectiveHours: effHours,
        rating: r
      });
    }

    const monthlyStats = {
      totalHours: Number((monthlyTotalMinutes / 60).toFixed(2)),
      avgProductivityRating: ratedDaysCount > 0 ? Number((totalRatings / ratedDaysCount).toFixed(1)) : 0,
      chartData: monthlyData
    };

    return res.json({
      today: todayStats,
      weekly: weeklyStats,
      monthly: monthlyStats
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
