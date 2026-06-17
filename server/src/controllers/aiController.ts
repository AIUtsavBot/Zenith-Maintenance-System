import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllSessions, SessionData } from '../config/db.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

// Setup Gemini Client
const initGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch (error) {
    console.error('Failed to initialize Gemini Model:', error);
    return null;
  }
};

// Heuristic engine to simulate AI insights if Gemini key is missing
function generateLocalHeuristics(sessions: SessionData[], period: 'daily' | 'weekly'): string {
  if (sessions.length === 0) {
    return `### Productivity Insights
No session data has been logged yet. Start a work session and log your notes/ratings to receive productivity recommendations.`;
  }

  // Sort sessions to find most recent
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  
  if (period === 'daily') {
    const latest = sorted[0];
    const effHours = Number((latest.effectiveWorkMinutes / 60).toFixed(1));
    const breakHours = Number((latest.totalBreakMinutes / 60).toFixed(1));
    const rating = latest.rating || 0;
    const taskCount = latest.completedTasks.length;

    let summary = `### Daily Productivity Audit (${latest.date})\n\n`;
    
    // 1. Audit core stats
    summary += `* **Focus Time**: You completed **${effHours} hours** of effective work today, with **${breakHours} hours** spent on breaks. `;
    if (effHours > 8) {
      summary += `This was a long, high-output session. Make sure to get proper rest tonight. `;
    } else if (effHours > 4) {
      summary += `This represents a standard, productive focus window. `;
    } else {
      summary += `This was a shorter session. Ensure you are blocking out dedicated focus blocks if this was meant to be a full work day. `;
    }
    summary += `\n`;

    // 2. Break patterns
    const breakCount = latest.breaks.length;
    summary += `* **Break Patterns**: You took **${breakCount} break(s)** today. `;
    if (breakCount === 0 && effHours > 2) {
      summary += `⚠️ You worked without breaks. Research shows taking a 5-10 minute break every 60-90 minutes reduces fatigue and maintains high cognitive function. `;
    } else if (breakCount > 5) {
      summary += `You had highly fragmented focus times with frequent breaks. Try using a Pomodoro timer (25m work, 5m break) to group breaks. `;
    } else if (breakCount > 0) {
      const avgBreak = Math.round(latest.totalBreakMinutes / breakCount);
      summary += `Your average break duration was **${avgBreak} minutes**, which is a healthy rhythm for mental decompression. `;
    }
    summary += `\n`;

    // 3. Task output & ratings
    summary += `* **Task Completion & Energy**: You marked **${taskCount} task(s)** completed and rated your flow state as **${rating}/10**. `;
    if (rating >= 8) {
      summary += `This indicates a strong flow state where tasks felt clear and achievable. Great job! `;
    } else if (rating >= 5) {
      summary += `This represents moderate focus. If you felt sluggish, examine if meetings or context-switching interrupted your momentum. `;
    } else if (rating > 0) {
      summary += `Flow state was low. Consider decluttering your workspace, planning only 1 major priority tomorrow, and turning off phone notifications. `;
    }
    summary += `\n\n`;

    // 4. Practical suggestions
    summary += `### Suggestions for Tomorrow:\n`;
    if (rating < 6) {
      summary += `1. **Monotasking**: Pick exactly one high-priority goal from your planner and work on it for the first 90 minutes of your day before checking emails.\n`;
      summary += `2. **Digital Minimalism**: Close extra browser tabs and put your phone in another room during focus sessions.\n`;
    } else {
      summary += `1. **Maintain Momentum**: Prepare tomorrow's checklist tonight so you can hit the ground running.\n`;
      summary += `2. **Optimize Rest**: End work at a structured time to avoid burnout and keep your creative energy high.\n`;
    }
    
    if (latest.completedTasks.length > 0) {
      summary += `\n**Completed Tasks Today**:\n` + latest.completedTasks.map(t => `- ${t}`).join('\n');
    }

    return summary;
  } else {
    // Weekly Audit (last 7 days of sessions)
    const recentWeek = sorted.slice(0, 7);
    const workingDays = recentWeek.filter(s => s.effectiveWorkMinutes > 0);
    const totalMinutes = workingDays.reduce((sum, s) => sum + s.effectiveWorkMinutes, 0);
    const avgMinutes = workingDays.length > 0 ? (totalMinutes / workingDays.length) : 0;
    const avgRating = workingDays.length > 0 ? (workingDays.reduce((sum, s) => sum + s.rating, 0) / workingDays.length) : 0;
    const totalTasks = workingDays.reduce((sum, s) => sum + s.completedTasks.length, 0);

    let summary = `### Weekly Performance Audit\n\n`;
    summary += `* **Volume & Consistency**: You worked **${workingDays.length} day(s)** this week, totaling **${(totalMinutes / 60).toFixed(1)} hours** (avg. **${(avgMinutes / 60).toFixed(1)} hours/day**).\n`;
    summary += `* **Flow Score**: Your average productivity rating was **${avgRating.toFixed(1)}/10** across working sessions.\n`;
    summary += `* **Output**: You completed **${totalTasks} tasks** in total.\n\n`;

    // Calculate consistency based on start times (variance in hours)
    const startHours = workingDays
      .map(s => s.workStart ? new Date(s.workStart).getHours() + (new Date(s.workStart).getMinutes() / 60) : null)
      .filter((h): h is number => h !== null);

    if (startHours.length > 1) {
      const avgStart = startHours.reduce((s, h) => s + h, 0) / startHours.length;
      const variance = startHours.reduce((s, h) => s + Math.pow(h - avgStart, 2), 0) / startHours.length;
      const stdDev = Math.sqrt(variance);

      summary += `* **Schedule Regularity**: `;
      if (stdDev < 1.0) {
        summary += `Highly consistent start times! You start work at roughly the same hour everyday (±${Math.round(stdDev * 60)} minutes). This helps prime your brain for deep work automatically. `;
      } else {
        summary += `Varying start times (fluctuating by ±${(stdDev).toFixed(1)} hours). If you experience trouble entering a flow state, establishing a fixed morning starting ritual can help. `;
      }
      summary += `\n\n`;
    }

    summary += `### Strategy Recommendations:\n`;
    summary += `1. **Plan Breaks Proactively**: Block break times on your calendar to ensure you step away from screens.\n`;
    summary += `2. **Protect Focus Blocks**: Schedule 2-hour blocks of uninterrupted work for complex tasks.\n`;
    summary += `3. **Theme Your Days**: Group similar administrative or brainstorming tasks together to minimize context switching.`;

    return summary;
  }
}

// Generate Insights endpoint
export async function getAiInsights(req: AuthenticatedRequest, res: Response) {
  const { period } = req.query; // 'daily' | 'weekly'
  const isWeekly = period === 'weekly';

  try {
    const sessions = getAllSessions();

    if (sessions.length === 0) {
      return res.json({
        insights: 'No data logged yet. Please log some sessions to unlock AI productivity insights.'
      });
    }

    const model = initGeminiModel();

    if (!model) {
      // Fall back to rule-based insights if Gemini is unavailable
      const localInsights = generateLocalHeuristics(sessions, isWeekly ? 'weekly' : 'daily');
      return res.json({
        insights: localInsights,
        engine: 'local-heuristic'
      });
    }

    // Prepare prompt payload for Gemini
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const recentSessions = isWeekly ? sorted.slice(0, 7) : [sorted[0]];

    let dataContext = '';
    recentSessions.forEach(s => {
      const start = s.workStart ? new Date(s.workStart).toLocaleTimeString() : 'N/A';
      const end = s.workEnd ? new Date(s.workEnd).toLocaleTimeString() : 'N/A';
      dataContext += `Date: ${s.date}
Status: ${s.status}
Work Session: ${start} to ${end}
Total Work: ${(s.totalWorkMinutes / 60).toFixed(2)} hrs, Total Break: ${(s.totalBreakMinutes / 60).toFixed(2)} hrs, Effective Focus: ${(s.effectiveWorkMinutes / 60).toFixed(2)} hrs
Breaks Taken: ${s.breaks.length} break(s)
Productivity Rating: ${s.rating}/10
Notes: ${s.notes}
Completed Tasks: ${s.completedTasks.join(', ')}
---
`;
    });

    const prompt = `
You are an expert personal productivity coach and work psychologist analyzing a user's daily work logs. 
Analyze the following work log data and compile a highly actionable, engaging, and professional report (in clean Markdown format) for a ${isWeekly ? 'weekly performance summary' : 'daily performance review'}.

Data:
${dataContext}

Your response should include:
1. A brief summary of findings (volume of work, start/end schedules, break habits).
2. Deep dive into flow states and productivity ratings vs tasks finished.
3. Analysis of work-to-break ratio and its impact on fatigue.
4. Exactly 3 clear, highly practical, and scientifically backed suggestions to improve focus, avoid burnout, or establish better routines tomorrow.

Do not use placeholders. Give specific feedback based on the numbers. Write in a motivating, clear, minimalistic tone (like Linear or Notion app writing style).
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return res.json({
      insights: responseText,
      engine: 'gemini'
    });
  } catch (error) {
    console.error('AI Insights generator error:', error);
    // If Gemini fails, fallback to local heuristics rather than crashing
    const sessions = getAllSessions();
    const fallback = generateLocalHeuristics(sessions, isWeekly ? 'weekly' : 'daily');
    return res.json({
      insights: fallback,
      engine: 'local-heuristic-fallback'
    });
  }
}
