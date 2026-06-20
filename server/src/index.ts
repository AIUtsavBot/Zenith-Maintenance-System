import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDb, isSupabaseConfigured, restoreFromSupabaseIfEmpty, retryUnsyncedData } from './config/db.js';
import { authenticateToken, requireAdmin } from './middlewares/authMiddleware.js';
import { login, changePassword, validateToken } from './controllers/authController.js';
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
import { getAiInsights } from './controllers/aiController.js';

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
app.post('/api/auth/login', login);
app.post('/api/auth/change-password', authenticateToken, changePassword);
app.get('/api/auth/validate', authenticateToken, validateToken);

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Office Hours Tracker backend server running on port ${PORT}`);
  });
}

export default app;
