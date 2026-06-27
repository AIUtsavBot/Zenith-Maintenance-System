import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import http from 'http';
import { initDb, isSupabaseConfigured, restoreFromSupabaseIfEmpty, retryUnsyncedData, getGroupActivityLogs } from './config/db.js';
import { authenticateToken, requireAdmin } from './middlewares/authMiddleware.js';
import { login, changePassword, validateToken, signup, googleLogin, listUsers, adminCreateUser, adminUpdateUser } from './controllers/authController.js';
import {
  getCurrentSession,
  startWork,
  startBreak,
  endBreak,
  endWork,
  resolveForgottenSession
} from './controllers/sessionController.js';
import {
  getProductivityData,
  updateProductivityData,
  getHistory,
  getDashboardSummary,
  getPlannerData,
  updatePlannerData
} from './controllers/productivityController.js';
import { getAiInsights, getGroupAiInsights } from './controllers/aiController.js';
import { initSocketServer } from './config/socket.js';
import { startReminderEngine } from './services/reminderEngine.js';

// New collaborative extension controllers
import {
  createGroup,
  listGroups,
  getGroupDetails,
  joinGroup,
  leaveGroup,
  deleteGroupEndpoint,
  transferOwnership,
  listGroupMembers,
  removeGroupMember,
  updateGroupMemberRole
} from './controllers/groupController.js';
import {
  createTask,
  getTasksList,
  getTaskDetails,
  updateTask,
  completeTask,
  addTaskComment,
  deleteTaskEndpoint
} from './controllers/taskController.js';
import {
  createGoal,
  listGoals,
  updateGoal,
  deleteGoalEndpoint
} from './controllers/goalController.js';
import {
  createReminder,
  listReminders,
  deleteReminderEndpoint
} from './controllers/reminderController.js';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotificationEndpoint
} from './controllers/notificationController.js';
import {
  getUserProfile,
  updateUserProfile,
  verifyEmail
} from './controllers/userPreferencesController.js';

dotenv.config();

// Initialize database (JSON storage setup)
initDb();
restoreFromSupabaseIfEmpty();
retryUnsyncedData();

// Periodically run background sync check every 5 minutes (in case network was offline on boot)
setInterval(() => {
  retryUnsyncedData().catch(err => console.error('Periodic background sync retry error:', err));
}, 5 * 60 * 1000);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware configuration
app.use(cors({
  origin: '*', // Allows all origins, easily adjustable for Vercel clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Server Status Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Authentication Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.post('/api/auth/google', googleLogin);
app.post('/api/auth/change-password', authenticateToken, changePassword);
app.get('/api/auth/validate', authenticateToken, validateToken);

// User Management (Admin-only)
app.get('/api/admin/users', authenticateToken, requireAdmin, listUsers);
app.post('/api/admin/users', authenticateToken, requireAdmin, adminCreateUser);
app.put('/api/admin/users/:username', authenticateToken, requireAdmin, adminUpdateUser);

// Work Session Tracking Routes
app.get('/api/session/current', authenticateToken, getCurrentSession);
app.post('/api/session/start', authenticateToken, startWork);
app.post('/api/session/break-start', authenticateToken, startBreak);
app.post('/api/session/break-end', authenticateToken, endBreak);
app.post('/api/session/end', authenticateToken, endWork);
app.post('/api/session/resolve-forgotten', authenticateToken, resolveForgottenSession);

// Daily Productivity & Log History Routes
app.get('/api/productivity', authenticateToken, getProductivityData);
app.post('/api/productivity', authenticateToken, updateProductivityData);
app.get('/api/productivity/history', authenticateToken, getHistory);
app.get('/api/dashboard/summary', authenticateToken, getDashboardSummary);

// Planner / Goals Routes
app.get('/api/planner/:date', authenticateToken, getPlannerData);
app.post('/api/planner/:date', authenticateToken, updatePlannerData);

// AI Insights Routes
app.get('/api/ai/insights', authenticateToken, getAiInsights);
app.get('/api/groups/:id/ai-insights', authenticateToken, getGroupAiInsights);

// Collaborative Group / Workspace Routes
app.post('/api/groups', authenticateToken, createGroup);
app.get('/api/groups', authenticateToken, listGroups);
app.post('/api/groups/join', authenticateToken, joinGroup);
app.get('/api/groups/:id', authenticateToken, getGroupDetails);
app.delete('/api/groups/:id', authenticateToken, deleteGroupEndpoint);
app.post('/api/groups/:id/leave', authenticateToken, leaveGroup);
app.post('/api/groups/:id/transfer', authenticateToken, transferOwnership);
app.get('/api/groups/:id/members', authenticateToken, listGroupMembers);
app.delete('/api/groups/:id/members/:memberUsername', authenticateToken, removeGroupMember);
app.put('/api/groups/:id/members/:memberUsername/role', authenticateToken, updateGroupMemberRole);
app.get('/api/groups/:id/activity', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const logs = getGroupActivityLogs(id);
    logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ activity: logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve activity feed' });
  }
});

// Shared Task Routes
app.post('/api/tasks', authenticateToken, createTask);
app.get('/api/tasks', authenticateToken, getTasksList);
app.get('/api/tasks/:id', authenticateToken, getTaskDetails);
app.put('/api/tasks/:id', authenticateToken, updateTask);
app.put('/api/tasks/:id/complete', authenticateToken, completeTask);
app.post('/api/tasks/:id/comments', authenticateToken, addTaskComment);
app.delete('/api/tasks/:id', authenticateToken, deleteTaskEndpoint);

// Goals Routes
app.post('/api/goals', authenticateToken, createGoal);
app.get('/api/goals', authenticateToken, listGoals);
app.put('/api/goals/:id', authenticateToken, updateGoal);
app.delete('/api/goals/:id', authenticateToken, deleteGoalEndpoint);

// Reminders Routes
app.post('/api/reminders', authenticateToken, createReminder);
app.get('/api/reminders', authenticateToken, listReminders);
app.delete('/api/reminders/:id', authenticateToken, deleteReminderEndpoint);

// Notifications Routes
app.get('/api/notifications', authenticateToken, listNotifications);
app.post('/api/notifications/read-all', authenticateToken, markAllNotificationsRead);
app.put('/api/notifications/:id/read', authenticateToken, markNotificationRead);
app.delete('/api/notifications/:id', authenticateToken, deleteNotificationEndpoint);

// User Profile & Preferences Routes
app.get('/api/users/profile', authenticateToken, getUserProfile);
app.put('/api/users/profile', authenticateToken, updateUserProfile);
app.post('/api/users/profile/verify-email', authenticateToken, verifyEmail);

// Configuration Status Routes
app.get('/api/settings/status', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    supabaseConfigured: isSupabaseConfigured(),
    databaseMode: isSupabaseConfigured() ? 'supabase' : 'local',
    supabaseUrl: process.env.SUPABASE_URL || 'Not Configured',
    aiModel: process.env.GEMINI_API_KEY ? 'gemini' : 'local-heuristics'
  });
});

// Serve frontend static assets in production
const CLIENT_DIST_PATH = path.join(process.cwd(), '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST_PATH));

// Fallback to index.html for React SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred' });
});

const server = http.createServer(app);
initSocketServer(server);
startReminderEngine();

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Zenith Focus backend server running on port ${PORT}`);
  });
}

export default app;
